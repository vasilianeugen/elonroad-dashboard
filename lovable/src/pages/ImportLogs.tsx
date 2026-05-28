import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle, CheckCircle2, Copy, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  validateChargingLogs,
  type NormalizedChargingLog,
  type ValidationIssue,
} from "@/utils/validateChargingLog";
import elonroadLogo from "@/assets/elonroad-logo.png";

/**
 * Parse the user's pasted text into raw row objects.
 *
 * Supported per-line formats (tab- OR multi-space-separated):
 *   vehicle  charger  date  startTime  endTime  startSoC  endSoC
 *
 * `date` may be DD/MM/YYYY, YYYY-MM-DD, or "YYYY-MM-DD / YYYY-MM-DD".
 * Lines starting with `#` or empty lines are ignored.
 *
 * The parser purposefully keeps everything as strings/numbers and lets
 * `validateChargingLogs` enforce the schema — that way malformed lines
 * surface as schema errors rather than silent parser failures.
 */
type ParsedLine =
  | { kind: "row"; lineNo: number; raw: string; row: Record<string, unknown> }
  | { kind: "error"; lineNo: number; raw: string; message: string };

const SOC_RE = /^\d{1,3}$/;

function parsePastedText(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((rawLine, i) => {
    const lineNo = i + 1;
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    // Split on tabs OR runs of 2+ spaces so single-space charger labels stay intact.
    let parts = trimmed.split(/\t+|\s{2,}/).map((p) => p.trim()).filter(Boolean);

    // Fallback: if user pasted single-space-separated and we got too few parts,
    // try collapsing — accept "Charger-5 Converter" style by reading from the right.
    if (parts.length < 7) {
      const tokens = trimmed.split(/\s+/);
      if (tokens.length >= 7) {
        // Last 5 tokens are: date startTime endTime startSoC endSoC OR
        //                     startTime endTime startSoC endSoC (date came earlier)
        // We expect exactly: vehicle, charger(maybe multi-word), date, start, end, ssoc, esoc
        const endSoC = tokens[tokens.length - 1];
        const startSoC = tokens[tokens.length - 2];
        const endTime = tokens[tokens.length - 3];
        const startTime = tokens[tokens.length - 4];
        // date may be "YYYY-MM-DD / YYYY-MM-DD" (3 tokens) or 1 token
        let dateTokens = 1;
        if (tokens[tokens.length - 5] === "/" || /^\d{4}-\d{2}-\d{2}$/.test(tokens[tokens.length - 7] ?? "")) {
          dateTokens = 3;
        }
        const dateStart = tokens.length - 4 - dateTokens;
        const date = tokens.slice(dateStart, dateStart + dateTokens).join(" ");
        const vehicle = tokens[0];
        const charger = tokens.slice(1, dateStart).join(" ");
        parts = [vehicle, charger, date, startTime, endTime, startSoC, endSoC];
      }
    }

    if (parts.length < 7) {
      out.push({
        kind: "error",
        lineNo,
        raw: rawLine,
        message: `Expected 7 fields (vehicle, charger, date, startTime, endTime, startSoC, endSoC), got ${parts.length}.`,
      });
      return;
    }

    const [vehicle, charger, date, startTime, endTime, startSoCStr, endSoCStr] = parts;

    if (!SOC_RE.test(startSoCStr) || !SOC_RE.test(endSoCStr)) {
      out.push({
        kind: "error",
        lineNo,
        raw: rawLine,
        message: `startSoC / endSoC must be integers 0–100 (got "${startSoCStr}", "${endSoCStr}").`,
      });
      return;
    }

    out.push({
      kind: "row",
      lineNo,
      raw: rawLine,
      row: {
        vehicle,
        charger,
        date,
        startTime,
        endTime,
        startSoC: Number(startSoCStr),
        endSoC: Number(endSoCStr),
      },
    });
  });

  return out;
}

const SAMPLE = `# Paste rows like the ones below (tab or 2+ spaces between fields).
# Cross-midnight dates: "YYYY-MM-DD / YYYY-MM-DD". Lines starting with # are ignored.
TT-107\tCharger-5 Converter\t21/04/2026\t13:41:02\t14:14:20\t67\t89
TT-108\tCharger-2 Converter\t21/04/2026\t13:45:16\t14:15:07\t74\t94
TT-106\tCharger-5 Converter\t2026-04-21 / 2026-04-22\t23:40:07\t00:03:10\t76\t95`;

interface LineResult {
  lineNo: number;
  raw: string;
  status: "ok" | "zero" | "error";
  normalized?: NormalizedChargingLog;
  issues: ValidationIssue[];
  parseError?: string;
}

const ImportLogs = () => {
  const navigate = useNavigate();
  const [text, setText] = useState("");

  const results = useMemo<LineResult[]>(() => {
    if (!text.trim()) return [];
    const parsed = parsePastedText(text);
    const rowsForValidation = parsed
      .filter((p): p is Extract<ParsedLine, { kind: "row" }> => p.kind === "row")
      .map((p) => p.row);
    const validation = validateChargingLogs(rowsForValidation);

    // Map validation results back to original line numbers.
    const rowOnly = parsed.filter((p) => p.kind === "row") as Array<
      Extract<ParsedLine, { kind: "row" }>
    >;
    const issuesByIndex = new Map<number, ValidationIssue[]>();
    for (const issue of validation.invalid) {
      const list = issuesByIndex.get(issue.index) ?? [];
      list.push(issue);
      issuesByIndex.set(issue.index, list);
    }

    // validation.valid preserves order of input rows.
    const validByIndex = new Map<number, NormalizedChargingLog>();
    let validCursor = 0;
    rowOnly.forEach((_, idx) => {
      if (!issuesByIndex.has(idx)) {
        validByIndex.set(idx, validation.valid[validCursor++]);
      }
    });

    const out: LineResult[] = [];
    parsed.forEach((p) => {
      if (p.kind === "error") {
        out.push({ lineNo: p.lineNo, raw: p.raw, status: "error", issues: [], parseError: p.message });
        return;
      }
      const idx = rowOnly.indexOf(p);
      const issues = issuesByIndex.get(idx) ?? [];
      if (issues.length > 0) {
        out.push({ lineNo: p.lineNo, raw: p.raw, status: "error", issues });
        return;
      }
      const norm = validByIndex.get(idx)!;
      out.push({
        lineNo: p.lineNo,
        raw: p.raw,
        status: norm.chargeAdded === 0 ? "zero" : "ok",
        issues: [],
        normalized: norm,
      });
    });
    return out;
  }, [text]);

  const counts = useMemo(() => {
    let ok = 0, zero = 0, error = 0;
    for (const r of results) {
      if (r.status === "ok") ok++;
      else if (r.status === "zero") zero++;
      else error++;
    }
    return { ok, zero, error, total: results.length };
  }, [results]);

  const generatedTs = useMemo(() => {
    const okRows = results.filter((r) => r.status === "ok" && r.normalized);
    if (okRows.length === 0) return "";
    return okRows
      .map((r, i) => {
        const v = r.normalized!;
        const id = `s_NEW_${String(i + 1).padStart(3, "0")}`;
        return `    { id: "${id}", vehicleId: "${v.vehicleId}", chargerId: "${v.chargerId}", date: "${v.date}", startTime: "${v.startTime}", endTime: "${v.endTime}", startSoC: ${v.startSoC}, endSoC: ${v.endSoC}, chargeAdded: ${v.chargeAdded}, chargingSpeed: ${v.chargingSpeed}, duration: ${v.duration} },`;
      })
      .join("\n");
  }, [results]);

  const copyTs = async () => {
    if (!generatedTs) return;
    await navigator.clipboard.writeText(generatedTs);
    toast.success("Copied TypeScript rows to clipboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={elonroadLogo} alt="Elonroad" className="h-7 w-auto" />
            <div>
              <h1 className="text-lg font-bold text-foreground">Import Charging Logs</h1>
              <p className="text-xs text-muted-foreground">Validate raw rows before they touch the dataset</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to dashboard
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Paste raw log lines
            </CardTitle>
            <CardDescription>
              One session per line: <code className="font-mono">vehicle&nbsp;charger&nbsp;date&nbsp;startTime&nbsp;endTime&nbsp;startSoC&nbsp;endSoC</code>.
              Tabs or 2+ spaces between fields. Cross-midnight dates use <code className="font-mono">YYYY-MM-DD / YYYY-MM-DD</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={SAMPLE}
              className="font-mono text-xs min-h-[200px]"
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setText(SAMPLE)}>
                Load example
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setText("")}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard label="Total lines" value={counts.total} tone="default" />
              <SummaryCard label="Valid (will insert)" value={counts.ok} tone="success" />
              <SummaryCard label="Zero-charge (filtered)" value={counts.zero} tone="muted" />
              <SummaryCard label="Errors" value={counts.error} tone={counts.error > 0 ? "error" : "default"} />
            </div>

            {counts.error > 0 ? (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertTitle>{counts.error} line{counts.error === 1 ? "" : "s"} need fixing</AlertTitle>
                <AlertDescription>
                  Fix the malformed lines below before updating the dataset. No data is committed from this page.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle2 className="w-4 h-4" />
                <AlertTitle>All lines pass validation</AlertTitle>
                <AlertDescription>
                  {counts.ok} ready to insert, {counts.zero} dropped per the zero-charge rule.
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="lines">
              <TabsList>
                <TabsTrigger value="lines">Per-line results</TabsTrigger>
                <TabsTrigger value="generated" disabled={!generatedTs}>
                  Generated TypeScript ({counts.ok})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="lines" className="mt-4">
                <Card>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Line</TableHead>
                          <TableHead className="w-28">Status</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((r) => (
                          <TableRow
                            key={r.lineNo}
                            className={cn(
                              r.status === "error" && "bg-destructive/5",
                              r.status === "zero" && "bg-muted/40",
                            )}
                          >
                            <TableCell className="font-mono text-xs align-top">{r.lineNo}</TableCell>
                            <TableCell className="align-top">
                              {r.status === "ok" && <Badge variant="default">OK</Badge>}
                              {r.status === "zero" && <Badge variant="secondary">Zero — filtered</Badge>}
                              {r.status === "error" && <Badge variant="destructive">Error</Badge>}
                            </TableCell>
                            <TableCell className="align-top space-y-1.5">
                              <div className="font-mono text-xs text-muted-foreground break-all">
                                {r.raw || <em>(empty)</em>}
                              </div>
                              {r.parseError && (
                                <div className="text-xs text-destructive flex items-start gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                  <span>{r.parseError}</span>
                                </div>
                              )}
                              {r.issues.map((iss, idx) => (
                                <div key={idx} className="text-xs text-destructive flex items-start gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                  <span>
                                    {iss.field ? <code className="font-mono mr-1">{iss.field}</code> : null}
                                    {iss.message}
                                  </span>
                                </div>
                              ))}
                              {r.normalized && (
                                <div className="text-xs text-muted-foreground">
                                  → <span className="font-mono">{r.normalized.vehicleId}</span>{" "}
                                  <span className="font-mono">{r.normalized.chargerId}</span>{" "}
                                  <span className="font-mono">{r.normalized.date}</span>{" "}
                                  {r.normalized.startTime}–{r.normalized.endTime}{" "}
                                  <span className={cn("font-semibold", r.normalized.chargeAdded > 0 ? "text-primary" : "text-muted-foreground")}>
                                    +{r.normalized.chargeAdded}%
                                  </span>{" "}
                                  · {r.normalized.duration} min
                                  {r.normalized.crossesMidnight && " · crosses midnight"}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="generated" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Legacy generated rows</CardTitle>
                    <CardDescription>
                      This legacy generator is not used by the dashboard anymore. The live dashboard reads from the database/API only.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <pre className="bg-muted text-xs font-mono p-3 rounded-md overflow-x-auto max-h-[400px]">
                      {generatedTs}
                    </pre>
                    <Button size="sm" onClick={copyTs}>
                      <Copy className="w-4 h-4 mr-2" /> Copy to clipboard
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
};

interface SummaryCardProps {
  label: string;
  value: number;
  tone: "default" | "success" | "muted" | "error";
}
const SummaryCard = ({ label, value, tone }: SummaryCardProps) => (
  <Card>
    <CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-2xl font-bold",
          tone === "success" && "text-primary",
          tone === "error" && "text-destructive",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </p>
    </CardContent>
  </Card>
);

export default ImportLogs;
