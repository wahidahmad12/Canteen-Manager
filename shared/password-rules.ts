export function passwordRules(password: string, username: string) {
  const length = Array.from(password).length;
  return {
    length: length >= 10 && length <= 72,
    bytes: new TextEncoder().encode(password).length <= 72,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    symbol: new RegExp("[\\p{P}\\p{S}]", "u").test(password),
    username: !!username && !password.toLowerCase().includes(username.toLowerCase()),
  };
}

export type PasswordRule = keyof ReturnType<typeof passwordRules>;
