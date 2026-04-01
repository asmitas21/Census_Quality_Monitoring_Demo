import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: React.ReactNode;
}

const variants: Record<Variant, string> = {
  primary: "bg-census-blue text-white hover:bg-census-blue-light focus:ring-census-blue",
  secondary: "bg-census-gray-200 text-census-gray-800 hover:bg-census-gray-300",
  outline: "border-2 border-census-blue text-census-blue hover:bg-census-blue/5",
  ghost: "text-census-blue hover:bg-census-blue/10",
};

export default function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  return (
    <button
      className={`px-4 py-2 rounded font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
