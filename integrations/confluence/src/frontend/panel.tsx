import React, { useEffect, useState } from "react";
import ForgeReconciler, {
  Box,
  Button,
  ButtonGroup,
  Heading,
  Inline,
  Label,
  Link,
  List,
  ListItem,
  LoadingButton,
  Lozenge,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  Textfield,
} from "@forge/react";
import { router } from "@forge/bridge";
import { call, isErr, type Err } from "./call";
import { explain, type RecordState } from "../lib/status";
import type { Finding } from "../lib/kl";

/**
 * The panel that opens from the label near the page title. Built only from Atlassian's own UI Kit components,
 * so it follows Confluence's light and dark themes and works at phone width (R12).
 */

type Load =
  | { linked: false; canEdit: boolean; configured: boolean }
  | { linked: true; lockId: string; canEdit: boolean; configured: boolean; state: RecordState; label: string; canCheck: boolean };
type Check = { summary: string; findings: Finding[]; truncated: boolean; checkedAt: string };

const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(iso));

function Problem({ title, text }: { title: string; text: string }) {
  return (
    <SectionMessage appearance="warning" title={title}>
      <Text>{text}</Text>
    </SectionMessage>
  );
}

function LinkForm({ onLinked }: { onLinked: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function link() {
    setBusy(true);
    setError("");
    const r = await call<{ ok: true }>("link", { link: value });
    setBusy(false);
    if (isErr(r)) setError(r.error);
    else onLinked();
  }
  return (
    <Stack space="space.150">
      <Stack space="space.050">
        <Label labelFor="kl-record-link">Link to the locked record</Label>
        <Textfield id="kl-record-link" name="link" value={value} placeholder="https://app.knowledge-lock.com/app/l/0x…" onChange={(e) => setValue(e.target.value)} />
        <Text size="small">Open the record in Knowledge Lock and copy the address from your browser.</Text>
      </Stack>
      {error ? <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage> : null}
      <Inline>
        <LoadingButton appearance="primary" isLoading={busy} isDisabled={!value.trim()} onClick={link}>
          Link this page
        </LoadingButton>
      </Inline>
    </Stack>
  );
}

function Findings({ result }: { result: Check }) {
  return (
    <Stack space="space.150">
      {result.truncated ? (
        <SectionMessage appearance="information">
          <Text>This page is long, so only its first 4,000 characters were checked.</Text>
        </SectionMessage>
      ) : null}
      {result.findings.length === 0 ? (
        <SectionMessage appearance="success" title="Nothing departing found">
          <Text>{result.summary || "The page doesn't depart from the locked record."}</Text>
        </SectionMessage>
      ) : (
        <Stack space="space.100">
          <Heading size="small">{`${result.findings.length} ${result.findings.length === 1 ? "finding" : "findings"}`}</Heading>
          {result.summary ? <Text>{result.summary}</Text> : null}
          <List type="unordered">
            {result.findings.map((f, i) => (
              <ListItem key={i}>
                <Stack space="space.050">
                  <Inline space="space.100" alignBlock="center">
                    <Lozenge appearance={f.kind === "departs" ? "removed" : "moved"}>
                      {f.kind === "departs" ? `Departs from ${f.requirementId}` : "Not in the record"}
                    </Lozenge>
                  </Inline>
                  <Text>{f.detail}</Text>
                  {f.excerpt ? <Text size="small">{`From the page: “${f.excerpt}”`}</Text> : null}
                </Stack>
              </ListItem>
            ))}
          </List>
        </Stack>
      )}
      <Text size="small">{`Checked at ${new Intl.DateTimeFormat("en-GB", { timeStyle: "short", dateStyle: "medium" }).format(new Date(result.checkedAt))}. Knowledge Lock doesn't keep a copy of the page.`}</Text>
    </Stack>
  );
}

function Record({ data, reload }: { data: Extract<Load, { linked: true }>; reload: () => void }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Check | null>(null);
  const [checkError, setCheckError] = useState("");
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [busy, setBusy] = useState(false);
  const { state } = data;

  async function check() {
    setChecking(true);
    setCheckError("");
    setResult(null);
    const r = await call<Check>("check");
    setChecking(false);
    if (isErr(r)) setCheckError(r.error);
    else setResult(r);
  }
  async function unlink() {
    setBusy(true);
    const r = await call<{ ok: true }>("unlink");
    setBusy(false);
    if (isErr(r)) setCheckError(r.error);
    else await router.reload();
  }
  async function retry() {
    await call("refresh");
    reload();
  }

  return (
    <Stack space="space.200">
      {state.kind === "record" ? (
        <Stack space="space.100">
          <Heading size="medium">{state.record.title}</Heading>
          <Text>{`Version ${state.record.version}, locked on ${day(state.record.lockedAt)}.`}</Text>
          {state.record.signedOffBy.length ? (
            <Stack space="space.050">
              <Text weight="bold">Signed off by</Text>
              <List type="unordered">
                {state.record.signedOffBy.map((s, i) => (
                  <ListItem key={i}>
                    <Text>{`${s.name}, on ${day(s.at)}${s.passkey ? ", with their own passkey" : ""}`}</Text>
                  </ListItem>
                ))}
              </List>
            </Stack>
          ) : null}
          <Inline>
            <Link href={state.record.url} openNewTab>
              Open in Knowledge Lock
            </Link>
          </Inline>
          {state.record.retired ? (
            <SectionMessage appearance="warning" title={`Retired on ${day(state.record.retired.retiredAt)} by ${state.record.retired.retiredBy}`}>
              <Text>{`This is no longer the signed-off version, so this page isn't checked against it. Reason: ${state.record.retired.reason}`}</Text>
            </SectionMessage>
          ) : state.record.newest ? (
            <SectionMessage appearance="information" title={`A newer version is available (v${state.record.newest.version})`}>
              <Stack space="space.100">
                <Text>This page is linked to an earlier version. An editor can link it to the newer one.</Text>
                <Link href={state.record.newest.url} openNewTab>
                  Open the newer version
                </Link>
              </Stack>
            </SectionMessage>
          ) : null}
          {!state.record.valid ? <Problem title="This record failed verification" text="Knowledge Lock couldn't verify this record, so the page isn't checked against it. An owner in Knowledge Lock can look into it." /> : null}
        </Stack>
      ) : state.kind === "closing" ? (
        <Problem title="Organisation closing" text={`${state.message} This page isn't checked any more.`} />
      ) : (
        <Stack space="space.100">
          <Problem {...explain(state.problem)} />
          <Inline>
            <Button onClick={retry}>Try again</Button>
          </Inline>
        </Stack>
      )}

      {data.canCheck ? (
        <Stack space="space.150">
          <Inline>
            <LoadingButton appearance="primary" isLoading={checking} onClick={check}>
              Check for drift
            </LoadingButton>
          </Inline>
          <Text size="small">Checks this page's current text against the locked version. It runs only when you press the button.</Text>
          {checkError ? <SectionMessage appearance="error"><Text>{checkError}</Text></SectionMessage> : null}
          {result ? <Findings result={result} /> : null}
        </Stack>
      ) : checkError ? (
        <SectionMessage appearance="error"><Text>{checkError}</Text></SectionMessage>
      ) : null}

      {data.canEdit ? (
        <Box>
          {confirmUnlink ? (
            <Stack space="space.100">
              <Text>Remove the link between this page and the record? The record itself isn't changed.</Text>
              <ButtonGroup label="Remove the link">
                <LoadingButton appearance="warning" isLoading={busy} onClick={unlink}>
                  Remove link
                </LoadingButton>
                <Button appearance="subtle" onClick={() => setConfirmUnlink(false)}>
                  Cancel
                </Button>
              </ButtonGroup>
            </Stack>
          ) : (
            <Button appearance="subtle" onClick={() => setConfirmUnlink(true)}>
              Remove link
            </Button>
          )}
        </Box>
      ) : null}
    </Stack>
  );
}

function App() {
  const [data, setData] = useState<Load | null>(null);
  const [error, setError] = useState("");
  async function load() {
    setError("");
    const r = await call<Load>("load");
    if (isErr(r)) setError(r.error);
    else setData(r);
  }
  useEffect(() => {
    load();
  }, []);

  if (error) return <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage>;
  if (!data) return <Spinner label="Loading" />;
  if (data.linked) return <Record data={data} reload={load} />;
  return (
    <Stack space="space.200">
      <Heading size="medium">Knowledge Lock</Heading>
      <Text>Link this page to a locked record, so readers can see what was signed off and check the page against it.</Text>
      {!data.configured ? (
        <Problem {...explain("not_configured")} />
      ) : data.canEdit ? (
        <LinkForm onLinked={() => router.reload()} />
      ) : (
        <Text>This page isn't linked to a record. Someone who can edit the page can link it.</Text>
      )}
    </Stack>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
