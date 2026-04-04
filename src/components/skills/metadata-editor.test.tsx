/**
 * Tests for MetadataEditor component
 * 
 * Note: Simplified tests without user-event dependency
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MetadataEditor } from './metadata-editor';

describe('MetadataEditor', () => {
  it('should render empty state', () => {
    const onChange = vi.fn();
    render(<MetadataEditor value={{}} onChange={onChange} />);

    expect(screen.getByText(/No metadata fields/i)).toBeInTheDocument();
  });

  it('should render existing metadata', () => {
    const onChange = vi.fn();
    const value = {
      author: 'John Doe',
      version: '1.0.0',
    };

    render(<MetadataEditor value={value} onChange={onChange} />);

    expect(screen.getByDisplayValue('author')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('version')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1.0.0')).toBeInTheDocument();
  });

  it('should show helpful tips', () => {
    const onChange = vi.fn();
    render(<MetadataEditor value={{}} onChange={onChange} />);

    expect(screen.getByText(/Use namespaced keys/i)).toBeInTheDocument();
    expect(screen.getByText(/Common metadata fields/i)).toBeInTheDocument();
  });
});
