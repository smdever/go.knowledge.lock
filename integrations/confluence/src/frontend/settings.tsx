import React, { useEffect, useState } from "react";
import ForgeReconciler, { Button, ButtonGroup, Heading, Inline, Label, Link, LoadingButton, SectionMessage, Spinner, Stack, Text, Textfield } from "@forge/react";
import { call, isErr } from "./call";

/** Settings for Confluence administrators: connect the site to one Knowledge Lock organisation (R1). */


function App() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    call<{ configured: boolean }>("settingsLoad").then((r) => (isErr(r) ? setError(r.error) : setConfigured(r.configured)));
  }, []);

  async function save() {
    setBusy(true);
    setError("");
    const r = await call<{ configured: boolean }>("settingsSave", { key });
    setBusy(false);
    setKey("");
    if (isErr(r)) return setError(r.error);
    setConfigured(true);
    setReplacing(false);
    setSaved(true);
  }
  async function disconnect() {
    setBusy(true);
    const r = await call<{ configured: boolean }>("settingsRemove");
    setBusy(false);
    if (isErr(r)) return setError(r.error);
    setConfigured(false);
    setSaved(false);
  }

  if (configured === null && !error) return <Spinner label="Loading" />;
  return (
    <Stack space="space.200">
      <Heading size="large">Knowledge Lock</Heading>
      <Text>
        Connect this Confluence site to your Knowledge Lock organisation. Editors can then link pages to locked records, and anyone who can view a
        page sees the record's status and can check the page for drift.
      </Text>
      {configured && !replacing ? (
        <Stack space="space.150">
          <SectionMessage appearance="success" title={saved ? "Connected" : "This site is connected"}>
            <Text>The API key is saved in the app's secure storage. It can't be shown again, but you can replace it or disconnect.</Text>
          </SectionMessage>
          {error ? <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage> : null}
          <ButtonGroup label="Connection">
            <Button onClick={() => { setReplacing(true); setSaved(false); }}>Replace the key</Button>
            <LoadingButton appearance="warning" isLoading={busy} onClick={disconnect}>
              Disconnect
            </LoadingButton>
          </ButtonGroup>
          <Text size="small">Disconnecting stops every linked page from showing its record until a key is added again. Page links are kept.</Text>
        </Stack>
      ) : (
        <Stack space="space.150">
          <Stack space="space.050">
            <Label labelFor="kl-api-key">Organisation API key</Label>
            <Textfield id="kl-api-key" name="key" type="password" value={key} placeholder="kl_live_…" onChange={(e) => setKey(e.target.value)} />
            <Text size="small">An owner can create a key on the API keys page in Knowledge Lock. Give it a name such as "Confluence".</Text>
          </Stack>
          {error ? <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage> : null}
          <Inline space="space.100">
            <LoadingButton appearance="primary" isLoading={busy} isDisabled={!key.trim()} onClick={save}>
              Check and save
            </LoadingButton>
            {replacing ? <Button appearance="subtle" onClick={() => { setReplacing(false); setError(""); }}>Cancel</Button> : null}
          </Inline>
          <Link href="https://app.knowledge-lock.com/app/api-keys" openNewTab>
            Open API keys in Knowledge Lock
          </Link>
        </Stack>
      )}
    </Stack>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
