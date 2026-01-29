/**
 * FileField component - Renders file input fields with drag-and-drop support
 * Supports file upload constraints (maxSize, allowedTypes, maxCount)
 */

import React, { useState, useRef } from 'react';
import { FileFieldProps } from '../../types';
import { FieldWrapper } from '../FieldWrapper';

/**
 * Formats file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validates a file against constraints
 */
function validateFile(
  file: File,
  maxSize?: number,
  allowedTypes?: string[]
): string | null {
  // Check file size
  if (maxSize && file.size > maxSize) {
    return `File size exceeds maximum allowed size of ${formatFileSize(maxSize)}`;
  }

  // Check MIME type
  if (allowedTypes && allowedTypes.length > 0) {
    const isAllowed = allowedTypes.some((type) => {
      // Support wildcards like "image/*"
      if (type.endsWith('/*')) {
        const prefix = type.slice(0, -2);
        return file.type.startsWith(prefix);
      }
      return file.type === type;
    });

    if (!isAllowed) {
      return `File type "${file.type}" is not allowed. Allowed types: ${allowedTypes.join(', ')}`;
    }
  }

  return null;
}

/**
 * FileField - Renders a file input field with drag-and-drop support
 *
 * Features:
 * - Drag-and-drop file upload area
 * - Click to browse file selection
 * - File size and MIME type validation
 * - Multiple file support
 * - File list display with removal
 * - Full accessibility support
 * - Visual feedback for drag state
 *
 * @example
 * ```tsx
 * <FileField
 *   path="documents"
 *   metadata={{
 *     path: 'documents',
 *     type: 'file',
 *     label: 'Upload Documents',
 *     required: true,
 *     schema: { type: 'file' }
 *   }}
 *   value={null}
 *   onChange={(files) => console.log(files)}
 *   maxSize={5 * 1024 * 1024} // 5MB
 *   allowedTypes={['application/pdf', 'image/*']}
 *   multiple={true}
 *   maxCount={3}
 * />
 * ```
 */
export const FileField: React.FC<FileFieldProps> = ({
  path,
  metadata,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  className = '',
  maxSize,
  allowedTypes,
  maxCount,
  multiple = false,
}) => {
  const { label, description, required, hint } = metadata;
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get current files as array
  const currentFiles: File[] = value
    ? Array.isArray(value)
      ? value
      : [value]
    : [];

  // Handle file selection (from input or drop)
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const newFiles = Array.from(files);

    // Validate each file
    for (const file of newFiles) {
      const validationResult = validateFile(file, maxSize, allowedTypes);
      if (validationResult) {
        setValidationError(validationResult);
        return;
      }
    }

    // Clear validation error if all files are valid
    setValidationError(null);

    // Check maxCount constraint
    if (maxCount && currentFiles.length + newFiles.length > maxCount) {
      setValidationError(`Maximum ${maxCount} file(s) allowed`);
      return;
    }

    // Update value based on multiple setting
    if (multiple) {
      onChange([...currentFiles, ...newFiles]);
    } else {
      onChange(newFiles[0]);
    }
  };

  // Handle file input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input value to allow selecting the same file again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  // Handle drag events
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!disabled) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Handle remove file
  const handleRemoveFile = (index: number) => {
    const newFiles = currentFiles.filter((_, i) => i !== index);

    if (newFiles.length === 0) {
      onChange(null);
    } else if (multiple) {
      onChange(newFiles);
    } else {
      onChange(newFiles[0] || null);
    }

    setValidationError(null);
  };

  // Handle click on drop zone
  const handleDropZoneClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  };

  // Handle keyboard events for accessibility
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Allow Enter or Space to trigger file selection
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleDropZoneClick();
    }
    // Allow Escape key to blur
    if (e.key === 'Escape') {
      e.currentTarget.blur();
    }
  };

  // Handle blur event
  const handleBlur = () => {
    if (onBlur) {
      onBlur();
    }
  };

  // Build accept attribute for input
  const accept = allowedTypes?.join(',');

  // Combine errors (validation error takes precedence over external error)
  const displayError = validationError || error;

  // Generate constraint hint text
  const constraints: string[] = [];
  if (maxSize) {
    constraints.push(`Max size: ${formatFileSize(maxSize)}`);
  }
  if (allowedTypes && allowedTypes.length > 0) {
    constraints.push(`Allowed types: ${allowedTypes.join(', ')}`);
  }
  if (maxCount) {
    constraints.push(`Max files: ${maxCount}`);
  }
  const constraintHint = constraints.length > 0 ? constraints.join(' • ') : undefined;

  return (
    <FieldWrapper
      path={path}
      label={label}
      description={description}
      required={required}
      error={displayError}
      className={`formbridge-file-field ${className}`.trim()}
    >
      <div className="formbridge-file-field__container">
        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          onChange={handleInputChange}
          disabled={disabled}
          accept={accept}
          multiple={multiple}
          className="formbridge-file-field__input"
          style={{ display: 'none' }}
          data-testid={`field-${path}-input`}
        />

        {/* Drag-and-drop zone */}
        <div
          className={`formbridge-file-field__dropzone ${
            isDragging ? 'formbridge-file-field__dropzone--dragging' : ''
          } ${disabled ? 'formbridge-file-field__dropzone--disabled' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleDropZoneClick}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={`${label} - Click or drag files to upload`}
          data-testid={`field-${path}-dropzone`}
        >
          <div className="formbridge-file-field__dropzone-content">
            <svg
              className="formbridge-file-field__dropzone-icon"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="formbridge-file-field__dropzone-text">
              {isDragging ? (
                <strong>Drop files here</strong>
              ) : (
                <>
                  <strong>Click to browse</strong> or drag and drop
                </>
              )}
            </p>
            {constraintHint && (
              <p className="formbridge-file-field__dropzone-hint">
                {constraintHint}
              </p>
            )}
          </div>
        </div>

        {/* File list */}
        {currentFiles.length > 0 && (
          <ul
            className="formbridge-file-field__file-list"
            role="list"
            aria-label="Selected files"
          >
            {currentFiles.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="formbridge-file-field__file-item"
                data-testid={`field-${path}-file-${index}`}
              >
                <div className="formbridge-file-field__file-info">
                  <span className="formbridge-file-field__file-name">
                    {file.name}
                  </span>
                  <span className="formbridge-file-field__file-size">
                    {formatFileSize(file.size)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(index)}
                  disabled={disabled}
                  className="formbridge-file-field__remove-button"
                  aria-label={`Remove ${file.name}`}
                  data-testid={`field-${path}-remove-${index}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FieldWrapper>
  );
};

FileField.displayName = 'FileField';
