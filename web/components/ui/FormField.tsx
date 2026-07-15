import clsx from 'clsx';
import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}

// Envoltorio label + control, réplica de .field-group (admin) / .rform-* (usuario).
export function FormField({ label, htmlFor, required, error, children, className }: FormFieldProps) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold opacity-70">
        {label}
        {required && <span className="text-admin-red"> *</span>}
      </label>
      {children}
      {error && <span className="text-xs font-medium text-admin-red">{error}</span>}
    </div>
  );
}

const baseControlClass =
  'w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-admin-blue dark:border-white/10 dark:bg-admin-dark-bg';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={clsx(baseControlClass, className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea {...rest} className={clsx(baseControlClass, 'min-h-24 resize-y', className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return <select {...rest} className={clsx(baseControlClass, className)} />;
}
