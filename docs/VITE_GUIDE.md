# Vite & React SPA Integration Guide

This guide covers integrating `@nairaramp/react` and `@nairaramp/core` into a standalone React single-page application built with Vite.

## 1. Install Dependencies

```bash
pnpm add @nairaramp/react @nairaramp/core
```

## 2. Vite Configuration

`@nairaramp/core` depends on `@stellar/typescript-wallet-sdk`, which may reference Node-style `global` or `Buffer` in some browser bundles. If you encounter `global is not defined` or `Buffer is not defined` during `vite build` or dev serving, configure `define` in `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
});
```

## 3. Sample Checkout Component

```tsx
import { useState } from "react";
import { createRamp, freighterSigner, type TransactionStatus } from "@nairaramp/core";
import { PayWithNaira, StatusTimeline } from "@nairaramp/react";

const ramp = createRamp({
  network: "testnet",
  anchorId: "sdf-testanchor",
  signer: freighterSigner(),
});

export function Checkout() {
  const [status, setStatus] = useState<TransactionStatus | string | undefined>(undefined);

  return (
    <div style={{ display: "grid", gap: "16px", maxWidth: "420px" }}>
      <PayWithNaira
        ramp={ramp}
        assetCode="SRT"
        amount="5000"
        theme="system"
        onComplete={() => setStatus("completed")}
        onError={(err) => console.error(err.code, err.message)}
      />
      <StatusTimeline status={status} />
    </div>
  );
}
```
