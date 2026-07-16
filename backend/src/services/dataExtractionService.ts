import { Document, DocumentType, ExtractedDocumentData } from '../types';
import { sanitizeInput } from '../utils/sanitize';
import { logger } from '../utils/logger';

/**
 * Data Extraction Service
 *
 * In a production system this would use OCR + NLP to extract data from
 * uploaded files. Here we simulate extraction based on the document metadata
 * and the application's own declared fields. The simulation produces realistic
 * extracted data with deliberate variations for test scenarios.
 *
 * NOTE: All extracted text is treated as untrusted input and passed through
 * the sanitizer to detect prompt-injection attempts embedded in documents.
 */
export class DataExtractionService {
  /**
   * Extract structured data from a document.
   * Returns extracted fields and flags any suspicious content.
   */
  async extractFromDocument(
    doc: Document,
    applicationData: Record<string, unknown>
  ): Promise<ExtractedDocumentData> {
    logger.info('Extracting data from document', {
      documentId: doc.id,
      documentType: doc.document_type,
    });

    const extracted = this.simulateExtraction(doc, applicationData);

    // Sanitize all string fields - treat document content as untrusted
    const suspiciousInstructions: string[] = [];
    for (const [key, value] of Object.entries(extracted)) {
      if (typeof value === 'string') {
        const sanitized = sanitizeInput(value);
        if (sanitized.injectionDetected) {
          suspiciousInstructions.push(
            `Field "${key}" contained suspicious content: ${sanitized.detectedPatterns.join(', ')}`
          );
          (extracted as Record<string, unknown>)[key] = sanitized.sanitizedText;
          logger.warn('Prompt injection detected in document', {
            documentId: doc.id,
            field: key,
          });
        }
      }
    }

    if (suspiciousInstructions.length > 0) {
      extracted.suspiciousInstructions = suspiciousInstructions;
    }

    return extracted;
  }

  private simulateExtraction(
    doc: Document,
    app: Record<string, unknown>
  ): ExtractedDocumentData {
    const docType = doc.document_type as DocumentType;

    // Base extraction mirrors declared application data (simulates correct documents)
    const baseName = (app.applicant_name as string) || '';
    const baseAddress = app.address
      ? `${app.address}, ${app.city || ''}, ${app.state || ''} ${app.zip_code || ''}`.trim()
      : '';
    const baseIncome = app.annual_income as number | undefined;
    const baseEmployer = (app.employer_name as string) || '';

    // Special case: filename or notes contain injection attempt
    const notesText = (app.notes as string) || '';
    const filenameText = doc.original_filename;
    const combinedText = `${notesText} ${filenameText}`;

    switch (docType) {
      case 'GOVERNMENT_ID': {
        const dob = app.date_of_birth
          ? new Date(app.date_of_birth as string).toISOString().split('T')[0]
          : '1990-01-01';
        return {
          name: baseName,
          address: baseAddress,
          dateOfBirth: dob,
          documentNumber: `ID-${Math.floor(Math.random() * 9000000 + 1000000)}`,
          issueDate: '2020-01-15',
          expiryDate: '2030-01-15',
          extractionNotes: `Government ID extracted from: ${doc.original_filename}`,
          ...(combinedText && { _rawText: combinedText }),
        };
      }

      case 'INCOME_PROOF': {
        // Slight variation to test consistency checking: round to nearest 100
        const extractedIncome = baseIncome
          ? Math.round(baseIncome / 100) * 100
          : undefined;
        return {
          name: baseName,
          income: extractedIncome,
          employer: baseEmployer,
          extractionNotes: `Income proof extracted from: ${doc.original_filename}`,
          ...(combinedText && { _rawText: combinedText }),
        };
      }

      case 'BANK_STATEMENT': {
        const monthlyIncome = baseIncome ? baseIncome / 12 : 0;
        const avgBalance = monthlyIncome * 2.5;
        return {
          name: baseName,
          accountNumber: `****${Math.floor(Math.random() * 9000 + 1000)}`,
          averageBalance: Math.round(avgBalance),
          income: baseIncome,
          extractionNotes: `Bank statement extracted from: ${doc.original_filename}`,
          ...(combinedText && { _rawText: combinedText }),
        };
      }

      case 'CREDIT_REPORT': {
        return {
          name: baseName,
          extractionNotes: `Credit report extracted from: ${doc.original_filename}`,
          ...(combinedText && { _rawText: combinedText }),
        };
      }

      default:
        return {
          extractionNotes: `Document of type ${docType} extracted from: ${doc.original_filename}`,
        };
    }
  }

  /**
   * Extract and aggregate data from multiple documents.
   * Used to build a consolidated view for consistency checking.
   */
  async extractFromDocuments(
    docs: Document[],
    applicationData: Record<string, unknown>
  ): Promise<Map<DocumentType, ExtractedDocumentData>> {
    const results = new Map<DocumentType, ExtractedDocumentData>();

    for (const doc of docs) {
      const extracted = await this.extractFromDocument(doc, applicationData);
      results.set(doc.document_type as DocumentType, extracted);
    }

    return results;
  }
}

export const dataExtractionService = new DataExtractionService();
export default dataExtractionService;
