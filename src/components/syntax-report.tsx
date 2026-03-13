'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { SyntaxAnalysisResult } from '@/lib/syntax-analysis'
import type { CrossFileResult } from '@/lib/cross-file-analysis'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  Code,
  Copy,
  FileInput,
  FileOutput,
  PackageOpen,
  Workflow,
} from 'lucide-react'

// Mediagenix AIR palette tokens
const COLOR = {
  teal: '#2DD4BF',
  amber: '#F59E0B',
  red: '#F87171',
  navy: '#1F2D45',
  blue: '#3B82F6',
} as const

function complexityBadge(complexity: number) {
  if (complexity < 5) {
    return (
      <Badge
        className="font-mono text-[10px]"
        style={{ backgroundColor: COLOR.teal, color: COLOR.navy }}
      >
        {complexity}
      </Badge>
    )
  }
  if (complexity <= 10) {
    return (
      <Badge
        className="font-mono text-[10px]"
        style={{ backgroundColor: COLOR.amber, color: COLOR.navy }}
      >
        {complexity}
      </Badge>
    )
  }
  return (
    <Badge
      className="font-mono text-[10px]"
      style={{ backgroundColor: COLOR.red, color: '#fff' }}
    >
      {complexity}
    </Badge>
  )
}

interface SyntaxReportProps {
  result: SyntaxAnalysisResult
  crossFileResult?: CrossFileResult
}

export function SyntaxReport({ result, crossFileResult }: SyntaxReportProps) {
  const hasCrossFile = !!crossFileResult
  const hasIssues =
    result.unusedImports.length > 0 ||
    result.duplicateBlocks.length > 0 ||
    (crossFileResult &&
      (crossFileResult.circularDeps.length > 0 ||
        crossFileResult.unusedExports.length > 0 ||
        crossFileResult.missingImports.length > 0))

  return (
    <div className="space-y-4">
      {/* Functions */}
      <Card style={{ borderColor: `${COLOR.navy}40` }}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Code className="h-4 w-4" style={{ color: COLOR.teal }} />
            Functions
            <Badge variant="secondary" className="ml-auto font-mono text-xs">
              {result.functions.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {result.functions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No functions detected.
            </p>
          ) : (
            <div className="space-y-1">
              {result.functions.map((fn, i) => (
                <div
                  key={`${fn.name}-${fn.startLine}-${i}`}
                  className="flex items-center justify-between rounded-md px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-medium truncate">
                      {fn.isAsync && (
                        <span className="text-muted-foreground mr-1">
                          async{' '}
                        </span>
                      )}
                      {fn.name}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      L{fn.startLine}
                      {fn.endLine !== fn.startLine && `\u2013${fn.endLine}`}
                    </span>
                    {fn.isExported && (
                      <Badge variant="outline" className="text-[10px] px-1">
                        export
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {fn.paramCount} param{fn.paramCount !== 1 ? 's' : ''}
                    </span>
                    {complexityBadge(fn.complexity)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Imports & Exports */}
      <Card style={{ borderColor: `${COLOR.navy}40` }}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ArrowRightLeft
              className="h-4 w-4"
              style={{ color: COLOR.blue }}
            />
            Imports / Exports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {/* Imports */}
            <AccordionItem value="imports">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <FileInput className="h-3.5 w-3.5" />
                  Imports
                  <Badge variant="secondary" className="font-mono text-xs">
                    {result.imports.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {result.imports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No imports.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {result.imports.map((imp, i) => (
                      <li
                        key={`${imp.source}-${imp.line}-${i}`}
                        className="flex items-center gap-2 font-mono text-xs px-2 py-1 rounded hover:bg-muted/50"
                      >
                        <span className="text-muted-foreground">
                          L{imp.line}
                        </span>
                        <span className="truncate">{imp.source}</span>
                        {imp.isDynamic && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1"
                          >
                            dynamic
                          </Badge>
                        )}
                        {imp.isDefault && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1"
                          >
                            default
                          </Badge>
                        )}
                        {imp.specifiers.length > 0 && (
                          <span className="text-muted-foreground truncate">
                            {'{ '}
                            {imp.specifiers.join(', ')}
                            {' }'}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Exports */}
            <AccordionItem value="exports">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <FileOutput className="h-3.5 w-3.5" />
                  Exports
                  <Badge variant="secondary" className="font-mono text-xs">
                    {result.exports.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {result.exports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No exports.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {result.exports.map((exp, i) => (
                      <li
                        key={`${exp.name}-${exp.line}-${i}`}
                        className="flex items-center gap-2 font-mono text-xs px-2 py-1 rounded hover:bg-muted/50"
                      >
                        <span className="text-muted-foreground">
                          L{exp.line}
                        </span>
                        <span>{exp.name}</span>
                        {exp.isDefault && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1"
                          >
                            default
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Classes */}
            {result.classes.length > 0 && (
              <AccordionItem value="classes">
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <PackageOpen className="h-3.5 w-3.5" />
                    Classes
                    <Badge variant="secondary" className="font-mono text-xs">
                      {result.classes.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-1 text-sm">
                    {result.classes.map((cls) => (
                      <li
                        key={cls}
                        className="font-mono text-xs px-2 py-1 rounded hover:bg-muted/50"
                      >
                        {cls}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </CardContent>
      </Card>

      {/* Warnings */}
      {hasIssues && (
        <Card
          style={{
            borderColor: `${COLOR.amber}50`,
            backgroundColor: `${COLOR.amber}08`,
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle
                className="h-4 w-4"
                style={{ color: COLOR.amber }}
              />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {/* Unused imports */}
              {result.unusedImports.length > 0 && (
                <AccordionItem value="unused-imports">
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className="h-3.5 w-3.5"
                        style={{ color: COLOR.amber }}
                      />
                      Unused Imports
                      <Badge
                        className="font-mono text-[10px]"
                        style={{
                          backgroundColor: COLOR.amber,
                          color: COLOR.navy,
                        }}
                      >
                        {result.unusedImports.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1">
                      {result.unusedImports.map((name) => (
                        <li
                          key={name}
                          className="flex items-center gap-2 text-sm font-mono px-2 py-1"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: COLOR.amber }}
                          />
                          {name}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Duplicate blocks */}
              {result.duplicateBlocks.length > 0 && (
                <AccordionItem value="duplicates">
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center gap-2">
                      <Copy
                        className="h-3.5 w-3.5"
                        style={{ color: COLOR.amber }}
                      />
                      Duplicate Code Blocks
                      <Badge
                        className="font-mono text-[10px]"
                        style={{
                          backgroundColor: COLOR.amber,
                          color: COLOR.navy,
                        }}
                      >
                        {result.duplicateBlocks.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1">
                      {result.duplicateBlocks.map((dup, i) => (
                        <li
                          key={i}
                          className="text-sm px-2 py-1 font-mono text-muted-foreground"
                        >
                          Lines {dup.lines[0]}\u2013{dup.lines[1]} duplicate of
                          lines {dup.duplicateOf[0]}\u2013{dup.duplicateOf[1]}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Cross-file: circular deps */}
              {crossFileResult && crossFileResult.circularDeps.length > 0 && (
                <AccordionItem value="circular-deps">
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center gap-2">
                      <AlertCircle
                        className="h-3.5 w-3.5"
                        style={{ color: COLOR.red }}
                      />
                      Circular Dependencies
                      <Badge
                        className="font-mono text-[10px]"
                        style={{ backgroundColor: COLOR.red, color: '#fff' }}
                      >
                        {crossFileResult.circularDeps.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2">
                      {crossFileResult.circularDeps.map((cycle, i) => (
                        <li
                          key={i}
                          className="text-sm font-mono px-2 py-1.5 rounded-md"
                          style={{ backgroundColor: `${COLOR.red}10` }}
                        >
                          {cycle.join(' \u2192 ')}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Cross-file: unused exports */}
              {crossFileResult &&
                crossFileResult.unusedExports.length > 0 && (
                  <AccordionItem value="unused-exports">
                    <AccordionTrigger className="text-sm">
                      <div className="flex items-center gap-2">
                        <AlertTriangle
                          className="h-3.5 w-3.5"
                          style={{ color: COLOR.amber }}
                        />
                        Unused Exports
                        <Badge
                          className="font-mono text-[10px]"
                          style={{
                            backgroundColor: COLOR.amber,
                            color: COLOR.navy,
                          }}
                        >
                          {crossFileResult.unusedExports.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-1">
                        {crossFileResult.unusedExports.map((item, i) => (
                          <li
                            key={i}
                            className="flex items-center gap-2 text-sm px-2 py-1"
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: COLOR.amber }}
                            />
                            <span className="font-mono">{item.export}</span>
                            <span className="text-muted-foreground text-xs">
                              in {item.file}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                )}

              {/* Cross-file: missing imports */}
              {crossFileResult &&
                crossFileResult.missingImports.length > 0 && (
                  <AccordionItem value="missing-imports">
                    <AccordionTrigger className="text-sm">
                      <div className="flex items-center gap-2">
                        <AlertCircle
                          className="h-3.5 w-3.5"
                          style={{ color: COLOR.red }}
                        />
                        Missing Imports
                        <Badge
                          className="font-mono text-[10px]"
                          style={{ backgroundColor: COLOR.red, color: '#fff' }}
                        >
                          {crossFileResult.missingImports.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-1">
                        {crossFileResult.missingImports.map((item, i) => (
                          <li
                            key={i}
                            className="flex items-center gap-2 text-sm px-2 py-1"
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: COLOR.red }}
                            />
                            <span className="font-mono">{item.import}</span>
                            <span className="text-muted-foreground text-xs">
                              from &quot;{item.from}&quot; in {item.file}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                )}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Cross-file: shared dependencies */}
      {hasCrossFile &&
        Object.keys(crossFileResult!.sharedDependencies).length > 0 && (
          <Card style={{ borderColor: `${COLOR.navy}40` }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Workflow
                  className="h-4 w-4"
                  style={{ color: COLOR.teal }}
                />
                Shared Dependencies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(crossFileResult!.sharedDependencies).map(
                  ([pkg, files]) => (
                    <div
                      key={pkg}
                      className="rounded-md px-3 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">
                          {pkg}
                        </span>
                        <Badge
                          variant="secondary"
                          className="font-mono text-[10px]"
                        >
                          {files.length} files
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {files.join(', ')}
                      </p>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  )
}
