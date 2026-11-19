import { describe, expect, it } from 'vitest';
import { format } from './format';

describe('format', () => {
  it('interpolates named parameters', () => {
    expect(format('Máximo {max} caracteres', { max: 254 })).toBe('Máximo 254 caracteres');
  });

  it('formats numbers for es-CO', () => {
    expect(format('{n}', { n: 1234.5 })).toBe('1.234,5');
  });

  it('keeps unknown placeholders visible', () => {
    expect(format('Hola {name}')).toBe('Hola {name}');
  });

  it('repeats the same parameter', () => {
    expect(format('{a} y {a}', { a: 'x' })).toBe('x y x');
  });
});
