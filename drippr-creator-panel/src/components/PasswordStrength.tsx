import { Check, X } from "lucide-react";

interface Props {
  password: string;
}

const RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /\d/.test(p) },
  { label: "One special character", test: (p: string) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;']/.test(p) },
];

export function passwordPassesAll(password: string): boolean {
  return RULES.every((r) => r.test(password));
}

export default function PasswordStrength({ password }: Props) {
  if (!password) return null;

  return (
    <ul className="mt-2 space-y-1 text-sm">
      {RULES.map((rule) => {
        const pass = rule.test(password);
        return (
          <li key={rule.label} className="flex items-center gap-2">
            {pass ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <X className="h-4 w-4 text-red-400" />
            )}
            <span className={pass ? "text-green-600" : "text-muted-foreground"}>
              {rule.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
