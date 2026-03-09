import * as React from 'react';
import { cn } from '@/lib/utils';

interface SimpleMarkdownProps {
  text: string;
  className?: string;
}

function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const inlineRegex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const full = match[0];
    if (match[1]) {
      nodes.push(
        <code key={match.index} className="bg-charcoal/[0.05] px-1.5 py-0.5 font-mono text-sm text-teal border border-border">
          {full.slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      nodes.push(<strong key={match.index} className="font-semibold text-charcoal">{full.slice(2, -2)}</strong>);
    } else if (match[3] || match[4]) {
      nodes.push(<em key={match.index} className="italic">{full.slice(1, -1)}</em>);
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function renderBlock(block: string, index: number): React.ReactNode {
  const trimmed = block.trim();

  if (trimmed.startsWith('```')) {
    const lines = trimmed.split('\n');
    const codeLines = lines.slice(1, lines[lines.length - 1] === '```' ? -1 : undefined);
    return (
      <pre key={index} className="my-3 overflow-x-auto bg-[#1A1D21] p-4 text-sm leading-relaxed border border-border">
        <code className="font-mono text-[#A8E6CF]">{codeLines.join('\n')}</code>
      </pre>
    );
  }

  const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const content = headingMatch[2];
    const Tag = `h${level + 1}` as 'h2' | 'h3' | 'h4';
    const cls = level === 1 ? 'text-lg font-semibold' : level === 2 ? 'text-base font-semibold' : 'text-[15px] font-medium';
    return (
      <Tag key={index} className={cn('mt-4 mb-1.5 text-charcoal', cls)}>
        {parseInline(content)}
      </Tag>
    );
  }

  const lines = trimmed.split('\n');
  const isUL = lines.every((l) => /^[\s]*[-*]\s/.test(l));
  const isOL = lines.every((l) => /^[\s]*\d+\.\s/.test(l));

  if (isUL) {
    return (
      <ul key={index} className="my-2 ml-4 space-y-1">
        {lines.map((line, i) => (
          <li key={i} className="text-base text-charcoal-light leading-relaxed pl-1 relative before:content-[''] before:absolute before:left-[-12px] before:top-[9px] before:h-1 before:w-1 before:rounded-full before:bg-muted-light">
            {parseInline(line.replace(/^[\s]*[-*]\s/, ''))}
          </li>
        ))}
      </ul>
    );
  }

  if (isOL) {
    return (
      <ol key={index} className="my-2 ml-4 list-decimal space-y-1 marker:text-muted-light marker:text-sm">
        {lines.map((line, i) => (
          <li key={i} className="text-base text-charcoal-light leading-relaxed pl-1">
            {parseInline(line.replace(/^[\s]*\d+\.\s/, ''))}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <p key={index} className="my-2 text-base leading-[1.7] text-charcoal-light">
      {parseInline(trimmed)}
    </p>
  );
}

export function SimpleMarkdown({ text, className }: SimpleMarkdownProps) {
  if (!text) return null;

  const blocks: string[] = [];
  let current = '';
  let inCodeBlock = false;

  for (const line of text.split('\n')) {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        current += '\n' + line;
        blocks.push(current);
        current = '';
        inCodeBlock = false;
      } else {
        if (current.trim()) blocks.push(current);
        current = line;
        inCodeBlock = true;
      }
    } else if (inCodeBlock) {
      current += '\n' + line;
    } else if (line.trim() === '') {
      if (current.trim()) blocks.push(current);
      current = '';
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current.trim()) blocks.push(current);

  return (
    <div className={cn('space-y-0', className)}>
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}
