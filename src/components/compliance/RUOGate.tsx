"use client";

import { useState } from "react";
import { Modal, Checkbox, Button } from "@/components/ui";
import { RUO_STATEMENTS } from "@/lib/compliance";

interface RUOGateProps {
  open: boolean;
  onAcknowledge: (payload: RUOAcknowledgmentPayload) => void;
  onCancel: () => void;
}

export interface RUOAcknowledgmentPayload {
  /** The exact certification text the user agreed to — stored with the order record */
  certification_text: string;
  /** Client-side timestamp; server re-stamps on receive */
  acknowledged_at: string;
  /** The two compound checks the user confirmed */
  is_adult: boolean;
  is_researcher: boolean;
  accepts_ruo: boolean;
}

/**
 * RUO (research-use-only) acknowledgment gate.
 *
 * Blocking modal triggered on first cart-add and replayed at checkout.
 * Three required checkboxes: age (21+), researcher status, and the full
 * RUO certification. Submit button is disabled until all three are true.
 *
 * Framework ref: RUO compliance framework §5 — customer certification is
 * the single strongest affirmative-defense asset we have.
 *
 * **Current state:** the callback delivers acknowledgment metadata to the
 * caller; the caller is responsible for persisting it server-side.
 * **TODO (phase 3):** wire a server action that inserts a row into
 * `ruo_acknowledgments` with IP address, user agent, and SHA-256 hash of the
 * certification text. Until that lands, any copy on the page/site that
 * claims permanent storage or account-binding is aspirational, not accurate.
 */
export function RUOGate({ open, onAcknowledge, onCancel }: RUOGateProps) {
  const [isAdult, setIsAdult] = useState(false);
  const [isResearcher, setIsResearcher] = useState(false);
  const [acceptsRuo, setAcceptsRuo] = useState(false);

  const canSubmit = isAdult && isResearcher && acceptsRuo;

  const handleConfirm = () => {
    if (!canSubmit) return;
    onAcknowledge({
      certification_text: RUO_STATEMENTS.certification,
      acknowledged_at: new Date().toISOString(),
      is_adult: isAdult,
      is_researcher: isResearcher,
      accepts_ruo: acceptsRuo,
    });
  };

  return (
    <Modal
      open={open}
      blocking
      title="Research-use-only certification"
      description="Before continuing, please confirm research intent. Your acknowledgment is recorded against this session and, once you complete an order, is retained with that order as part of our compliance record."
      size="lg"
    >
      <div className="flex flex-col gap-5">
        <Checkbox
          required
          checked={isAdult}
          onChange={(e) => setIsAdult(e.target.checked)}
          label="I certify that I am 21 years of age or older."
        />
        <Checkbox
          required
          checked={isResearcher}
          onChange={(e) => setIsResearcher(e.target.checked)}
          label="I am a researcher, scientist, or representative of a research institution, and I will use this product solely for in vitro research purposes."
        />
        <Checkbox
          required
          checked={acceptsRuo}
          onChange={(e) => setAcceptsRuo(e.target.checked)}
          label={
            <>
              I will not administer this product to humans or animals, and I will not resell it for
              consumption. I understand this product is not a drug, supplement, or medical device,
              and has not been evaluated by the FDA for any purpose other than laboratory research.
            </>
          }
        />

        <div className="mt-4 pt-4 border-t rule">
          <p className="text-xs text-ink-muted leading-relaxed mb-6">
            Your acknowledgment is timestamped and recorded against this session. When you place an
            order, it is retained with that order record as part of our compliance documentation.
            False certification voids our Terms of Sale and transfers liability to the customer.
          </p>
          <div className="flex flex-col sm:flex-row-reverse gap-3">
            <Button size="lg" onClick={handleConfirm} disabled={!canSubmit}>
              Confirm and continue
            </Button>
            <Button size="lg" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
