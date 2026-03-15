import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({ className, variant = 'primary', ...props }) => {
    return (
        <button
            className={clsx(
                "px-4 py-2 font-pixel text-white transition-transform active:scale-95 border-b-4",
                {
                    'bg-yellow-600 hover:bg-yellow-500 border-yellow-800': variant === 'primary',
                    'bg-gray-600 hover:bg-gray-500 border-gray-800': variant === 'secondary',
                    'bg-red-600 hover:bg-red-500 border-red-800': variant === 'danger',
                },
                "disabled:opacity-50 disabled:cursor-not-allowed",
                className
            )}
            {...props}
        />
    );
};
