import { describe, it, expect } from 'vitest';
import enTranslations from '@/locales/en.json';
import esTranslations from '@/locales/es.json';
import frTranslations from '@/locales/fr.json';

describe('i18n translations', () => {
  it('should have matching keys across all languages', () => {
    const enKeys = getAllKeys(enTranslations);
    const esKeys = getAllKeys(esTranslations);
    const frKeys = getAllKeys(frTranslations);

    expect(esKeys).toEqual(enKeys);
    expect(frKeys).toEqual(enKeys);
  });

  it('should have all required translation namespaces', () => {
    expect(enTranslations).toHaveProperty('common');
    expect(enTranslations).toHaveProperty('projects');
    expect(enTranslations).toHaveProperty('createProjectDialog');
    expect(enTranslations).toHaveProperty('auth');
  });

  it('should have non-empty translation values', () => {
    const enValues = getAllValues(enTranslations);
    const esValues = getAllValues(esTranslations);
    const frValues = getAllValues(frTranslations);

    enValues.forEach(value => {
      expect(value).toBeTruthy();
      expect(value.length).toBeGreaterThan(0);
    });

    esValues.forEach(value => {
      expect(value).toBeTruthy();
      expect(value.length).toBeGreaterThan(0);
    });

    frValues.forEach(value => {
      expect(value).toBeTruthy();
      expect(value.length).toBeGreaterThan(0);
    });
  });

  it('should have correct common translations', () => {
    expect(enTranslations.common.cancel).toBe('Cancel');
    expect(esTranslations.common.cancel).toBe('Cancelar');
    expect(frTranslations.common.cancel).toBe('Annuler');

    expect(enTranslations.common.create).toBe('Create');
    expect(esTranslations.common.create).toBe('Crear');
    expect(frTranslations.common.create).toBe('Créer');
  });
});

// Helper function to get all keys from a nested object
function getAllKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys.sort();
}

// Helper function to get all values from a nested object
function getAllValues(obj: any): string[] {
  let values: string[] = [];
  
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      values = values.concat(getAllValues(obj[key]));
    } else {
      values.push(obj[key]);
    }
  }
  
  return values;
}
