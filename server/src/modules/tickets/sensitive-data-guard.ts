/**
 * Sensitive Data Guard
 * Detects credit/debit card numbers using the Luhn algorithm and obvious password/credential leaks.
 */

export function isValidLuhn(digits: string): boolean {
  let sum = 0;
  let alternate = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits.charAt(i), 10);
    if (isNaN(n)) return false;

    if (alternate) {
      n *= 2;
      if (n > 9) {
        n -= 9;
      }
    }
    sum += n;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

export function detectCardNumbers(text: string): boolean {
  // Match potential card number strings (13-19 digits, possibly separated by spaces or hyphens)
  const candidateMatches = text.match(/\b(?:\d[ -]*){13,19}\b/g);
  if (!candidateMatches) return false;

  for (const candidate of candidateMatches) {
    const cleanDigits = candidate.replace(/[\s-]/g, '');
    if (cleanDigits.length >= 13 && cleanDigits.length <= 19) {
      if (isValidLuhn(cleanDigits)) {
        return true;
      }
    }
  }

  return false;
}

export function detectSensitiveSecrets(text: string): boolean {
  // Patterns like "password: xyz", "pwd=xyz", "api_key: xyz", "secret: xyz"
  const secretPatterns = [
    /(?:password|passwd|pwd)\s*[:=]\s*[^\s]{4,}/i,
    /(?:api[_-]?key|secret[_-]?key|bearer[_-]?token)\s*[:=]\s*[^\s]{8,}/i,
  ];

  for (const pattern of secretPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

export function validateSafeContent(text: string): { isSafe: boolean; reason?: string } {
  if (detectCardNumbers(text)) {
    return {
      isSafe: false,
      reason: 'Submission rejected: payment card number detected. Do not enter financial cards in tickets or comments.',
    };
  }

  if (detectSensitiveSecrets(text)) {
    return {
      isSafe: false,
      reason: 'Submission rejected: plaintext password or sensitive secret pattern detected.',
    };
  }

  return { isSafe: true };
}
