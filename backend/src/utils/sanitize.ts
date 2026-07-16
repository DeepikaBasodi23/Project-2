/**
 * Sanitization utilities to detect and strip prompt injection attempts
 * from untrusted user input (application notes, document content, etc.)
 */

// Patterns that indicate an attempt to manipulate the AI decision engine
const INJECTION_PATTERNS: RegExp[] = [
  /approve\s+(this\s+)?(loan|application|request)\s*(regardless|anyway|no\s+matter)/i,
  /ignore\s+(all\s+)?(rules|policy|guidelines|criteria)/i,
  /manager\s+said\s+(so|to\s+approve|approve)/i,
  /override\s+(the\s+)?(decision|rules|policy|system)/i,
  /you\s+(must|should|have\s+to)\s+approve/i,
  /automatically\s+approve/i,
  /bypass\s+(the\s+)?(checks|validation|scoring|rules)/i,
  /disregard\s+(the\s+)?(rules|policy|criteria)/i,
  /set\s+(score|rating)\s+to\s+\d+/i,
  /force\s+(approve|approval)/i,
  /this\s+is\s+a\s+test[,\s]+approve/i,
  /[<>{}\\].*?(script|eval|exec|system|admin)/i,
  /instruction[s]?\s*[:]\s*(approve|ignore|override)/i,
  /\[\s*SYSTEM\s*\]/i,
  /\[\s*ASSISTANT\s*\]/i,
  /\[\s*OVERRIDE\s*\]/i,
];

export interface SanitizationResult {
  originalText: string;
  sanitizedText: string;
  injectionDetected: boolean;
  detectedPatterns: string[];
}

/**
 * Detect and sanitize prompt injection attempts from text input.
 * Always treats the input as untrusted data.
 */
export function sanitizeInput(text: string): SanitizationResult {
  if (!text || typeof text !== 'string') {
    return {
      originalText: text || '',
      sanitizedText: text || '',
      injectionDetected: false,
      detectedPatterns: [],
    };
  }

  const detectedPatterns: string[] = [];
  let sanitizedText = text;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      detectedPatterns.push(pattern.toString());
      // Replace the matched content with a redaction notice
      sanitizedText = sanitizedText.replace(
        pattern,
        '[CONTENT REDACTED - POTENTIAL POLICY MANIPULATION ATTEMPT]'
      );
    }
  }

  return {
    originalText: text,
    sanitizedText,
    injectionDetected: detectedPatterns.length > 0,
    detectedPatterns,
  };
}

/**
 * Check if text contains injection patterns without modifying it.
 */
export function detectInjection(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

/**
 * Sanitize an entire application object's free-text fields.
 */
export function sanitizeApplicationFields(data: Record<string, unknown>): {
  sanitized: Record<string, unknown>;
  injectionDetected: boolean;
  flaggedFields: string[];
} {
  const freeTextFields = ['notes', 'loan_purpose', 'employer_name', 'address'];
  const flaggedFields: string[] = [];
  const sanitized = { ...data };

  for (const field of freeTextFields) {
    const value = data[field];
    if (typeof value === 'string') {
      const result = sanitizeInput(value);
      if (result.injectionDetected) {
        flaggedFields.push(field);
        sanitized[field] = result.sanitizedText;
      }
    }
  }

  return {
    sanitized,
    injectionDetected: flaggedFields.length > 0,
    flaggedFields,
  };
}
