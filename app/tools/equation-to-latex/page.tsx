import Link from 'next/link';
import { ArrowLeft, CodeXml, Eye } from 'lucide-react';
import EquationToLatexClient from './client';


export default function EquationToLatexPage() {
  return (
    <div className="min-h-screen bg-gray-50 dm_sans_b920ac53-module__OReNBa__className">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-light text-gray-900 mb-3">
            Equation to LaTeX Converter
          </h1>
          <p className="text-lg text-gray-600">
            Convert natural language equations or images to clean LaTeX code
          </p>
        </div>

        <EquationToLatexClient />
      </div>
    </div>
  );
}