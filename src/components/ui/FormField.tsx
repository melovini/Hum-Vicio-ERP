import { cloneElement, useId, type ReactElement, type ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; invalid?: boolean }>;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
}

export function FormField({ label, children, hint, error, required = false }: FormFieldProps) {
  const generatedId = useId();
  const inputId = children.props.id ?? generatedId;
  const descriptionId = hint || error ? `${inputId}-description` : undefined;

  const field = cloneElement(children, {
    id: inputId,
    'aria-describedby': descriptionId,
    invalid: Boolean(error) || children.props.invalid,
  });

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-text-secondary">
        {label}
        {required && <span className="ml-1 text-brand-primary" aria-hidden="true">*</span>}
      </label>
      {field}
      {(error || hint) && (
        <p id={descriptionId} role={error ? 'alert' : undefined} className={error ? 'text-xs text-status-danger' : 'text-xs text-text-muted'}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
