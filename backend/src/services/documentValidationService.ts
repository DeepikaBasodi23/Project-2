import { query, execute } from '../db/client';
import { normalizeRow } from '../db/normalize';
import {
  Document, DocumentType, DocumentValidationResult, Inconsistency, ExtractedDocumentData,
} from '../types';
import { dataExtractionService } from './dataExtractionService';
import { config } from '../config';
import { logger } from '../utils/logger';
import { sanitizeInput } from '../utils/sanitize';
import { v4 as uuidv4 } from 'uuid';

const ALWAYS_REQUIRED: DocumentType[] = ['GOVERNMENT_ID', 'INCOME_PROOF', 'BANK_STATEMENT'];

export class DocumentValidationService {
  async validateDocuments(
    applicationId: string,
    applicationData: Record<string, unknown>
  ): Promise<DocumentValidationResult> {
    logger.info('Document validation starting', { applicationId });

    const docs = await query<Document>('SELECT * FROM documents WHERE application_id = $1', [applicationId]);
    const required = config.creditReportRequired
      ? [...ALWAYS_REQUIRED, 'CREDIT_REPORT' as DocumentType]
      : ALWAYS_REQUIRED;

    const presentTypes = new Set(docs.map((d) => d.document_type as DocumentType));
    const missingDocuments = required.filter((r) => !presentTypes.has(r));
    const isComplete = missingDocuments.length === 0;

    // Sanitize notes
    const notes = applicationData.notes as string | undefined;
    if (notes && sanitizeInput(notes).injectionDetected) {
      logger.warn('Injection in application notes during validation', { applicationId });
    }

    if (!isComplete) {
      logger.info('Documents incomplete', { applicationId, missingDocuments });
      return this._save(applicationId, {
        is_complete: false, missing_documents: missingDocuments, inconsistencies: [],
        validation_passed: false,
        notes: `Missing required documents: ${missingDocuments.join(', ')}`,
      });
    }

    const extractedMap = await dataExtractionService.extractFromDocuments(
      docs, applicationData
    );

    const { inconsistencies, extractedName, extractedAddress, extractedIncome, extractedEmployer } =
      this._checkConsistency(extractedMap, applicationData);

    const declaredName = (applicationData.applicant_name as string) || '';
    const nameMatch = extractedName ? this._fuzzyName(extractedName, declaredName) : true;

    const declaredAddr = applicationData.address
      ? `${applicationData.address}, ${applicationData.city || ''}, ${applicationData.state || ''} ${applicationData.zip_code || ''}`.trim()
      : '';
    const addressMatch = extractedAddress && declaredAddr
      ? extractedAddress.toLowerCase().includes((applicationData.address as string || '').toLowerCase())
      : true;

    if (!nameMatch && extractedName) {
      inconsistencies.push({
        field: 'applicant_name', document1: 'APPLICATION', document2: 'GOVERNMENT_ID',
        value1: declaredName, value2: extractedName, severity: 'HIGH',
      });
    }

    const injectionFlags: string[] = [];
    for (const [docType, ext] of extractedMap.entries()) {
      if (ext.suspiciousInstructions?.length) {
        injectionFlags.push(`${docType}: ${ext.suspiciousInstructions.join('; ')}`);
      }
    }

    const validationPassed = isComplete && !inconsistencies.some((i) => i.severity === 'HIGH');
    let note = '';
    if (injectionFlags.length) note += `⚠ Injection detected: ${injectionFlags.join(' | ')}. `;
    if (inconsistencies.length) note += `${inconsistencies.length} inconsistency(ies) found.`;

    logger.info('Validation complete', { applicationId, validationPassed, inconsistencies: inconsistencies.length });

    return this._save(applicationId, {
      is_complete: true, missing_documents: [], inconsistencies,
      extracted_name: extractedName || undefined,
      extracted_address: extractedAddress || undefined,
      extracted_income: extractedIncome || undefined,
      extracted_employer: extractedEmployer || undefined,
      name_match: nameMatch, address_match: addressMatch,
      validation_passed: validationPassed,
      notes: note || 'All documents validated successfully.',
    });
  }

  private _checkConsistency(
    extractedMap: Map<DocumentType, ExtractedDocumentData>,
    app: Record<string, unknown>
  ) {
    const inconsistencies: Inconsistency[] = [];
    const govId = extractedMap.get('GOVERNMENT_ID');
    const income = extractedMap.get('INCOME_PROOF');
    const bank  = extractedMap.get('BANK_STATEMENT');

    const extractedName    = govId?.name || income?.name || null;
    const extractedAddress = govId?.address || null;
    const extractedIncome  = income?.income || bank?.income || null;
    const extractedEmployer = income?.employer || null;

    // Name consistency across docs
    const names = [
      govId?.name  && { source: 'GOVERNMENT_ID', value: govId.name },
      income?.name && { source: 'INCOME_PROOF',  value: income.name },
      bank?.name   && { source: 'BANK_STATEMENT', value: bank.name },
    ].filter(Boolean) as { source: string; value: string }[];

    for (let i = 0; i < names.length - 1; i++) {
      if (!this._fuzzyName(names[i].value, names[i + 1].value)) {
        inconsistencies.push({ field: 'name', document1: names[i].source, document2: names[i + 1].source,
          value1: names[i].value, value2: names[i + 1].value, severity: 'HIGH' });
      }
    }

    // Income variance > 10%
    const declaredIncome = app.annual_income as number | undefined;
    if (extractedIncome && declaredIncome) {
      const variance = Math.abs(extractedIncome - declaredIncome) / declaredIncome;
      if (variance > 0.1) {
        inconsistencies.push({ field: 'annual_income', document1: 'APPLICATION', document2: 'INCOME_PROOF',
          value1: String(declaredIncome), value2: String(extractedIncome), severity: variance > 0.25 ? 'HIGH' : 'MEDIUM' });
      }
    }

    return { inconsistencies, extractedName, extractedAddress, extractedIncome, extractedEmployer };
  }

  private _fuzzyName(a: string, b: string): boolean {
    const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    const n1 = norm(a); const n2 = norm(b);
    if (n1 === n2) return true;
    const p1 = n1.split(' '); const p2 = n2.split(' ');
    return p1[0] === p2[0] && p1[p1.length - 1] === p2[p2.length - 1];
  }

  private async _save(
    applicationId: string,
    data: Partial<DocumentValidationResult>
  ): Promise<DocumentValidationResult> {
    await execute('DELETE FROM document_validation_results WHERE application_id = $1', [applicationId]);
    const id = uuidv4();
    await execute(
      `INSERT INTO document_validation_results
         (id, application_id, is_complete, missing_documents, inconsistencies,
          extracted_name, extracted_address, extracted_income, extracted_employer,
          name_match, address_match, validation_passed, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, applicationId,
        data.is_complete ? 1 : 0,
        JSON.stringify(data.missing_documents ?? []),
        JSON.stringify(data.inconsistencies ?? []),
        data.extracted_name ?? null,
        data.extracted_address ?? null,
        data.extracted_income ?? null,
        data.extracted_employer ?? null,
        data.name_match === true ? 1 : data.name_match === false ? 0 : null,
        data.address_match === true ? 1 : data.address_match === false ? 0 : null,
        data.validation_passed ? 1 : 0,
        data.notes ?? null,
      ]
    );
    const rows = await query('SELECT * FROM document_validation_results WHERE id = ?', [id]);
    return normalizeRow<DocumentValidationResult>(rows[0] as Record<string, unknown>);
  }
}

export const documentValidationService = new DocumentValidationService();
export default documentValidationService;
