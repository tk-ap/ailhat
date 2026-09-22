import { createFileRoute } from "@tanstack/react-router";
import HereNowSandboxConnector from "~/components/HereNowSandboxConnector";

export const Route = createFileRoute("/mobile-proof")({
  component: MobileProof,
});

function MobileProof() {
  return (
    <main className="min-h-dvh bg-gray-950 p-4 text-gray-100">
      <div className="mx-auto w-full max-w-3xl">
        <HereNowSandboxConnector
          products={[
            { id: "ashwood", name: "ASHWOOD", repository: "tk-ap/ashwood-info", url: "https://ashwood-info.vercel.app/" },
            { id: "ailhat", name: "ailhat", repository: "tk-ap/ailhat", url: "https://ailhat.vercel.app/" },
          ]}
        />
      </div>
    </main>
  );
}
