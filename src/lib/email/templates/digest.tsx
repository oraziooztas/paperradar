// digest.tsx — Daily/weekly research digest email template
// Deps: @react-email/components | Used by: send-digest.ts
// Why: React Email template with dark theme, renders personalized paper digest

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Row,
  Column,
  Text,
  Link,
  Hr,
  Preview,
  render,
} from '@react-email/components'
import * as React from 'react'

// === TYPES ===

export interface DigestPaper {
  id: string
  title: string
  tldr: string | null
  gravity_score: number
  categories: string[]
  published_at: string
  arxiv_id: string
}

interface DigestEmailProps {
  userName: string
  papers: DigestPaper[]
  frequency: 'daily' | 'weekly'
  unsubscribeUrl: string
}

// === STYLE CONSTANTS ===

const colors = {
  bg: '#030712',
  cardBg: '#111827',
  text: '#f3f4f6',
  muted: '#9ca3af',
  accent: '#6366f1',
  border: '#1f2937',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
} as const

/** Return a badge color based on gravity score thresholds */
function getGravityColor(score: number): string {
  if (score >= 70) return colors.green
  if (score >= 40) return colors.yellow
  return colors.red
}

/** Format a date string to a human-readable form */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// === COMPONENT ===

export function DigestEmail({
  userName,
  papers,
  frequency,
  unsubscribeUrl,
}: DigestEmailProps) {
  const frequencyLabel = frequency === 'daily' ? 'Daily' : 'Weekly'
  const today = formatDate(new Date().toISOString())
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {`Your ${frequencyLabel} Research Digest — ${String(papers.length)} new paper${papers.length !== 1 ? 's' : ''}`}
      </Preview>
      <Body style={{ backgroundColor: colors.bg, margin: 0, padding: 0 }}>
        <Container
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '32px 16px',
          }}
        >
          {/* === HEADER === */}
          <Section style={{ textAlign: 'center', marginBottom: '32px' }}>
            <Text
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: colors.accent,
                margin: '0 0 4px 0',
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              PaperRadar
            </Text>
            <Text
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: colors.text,
                margin: '0 0 4px 0',
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Your {frequencyLabel} Research Digest
            </Text>
            <Text
              style={{
                fontSize: '14px',
                color: colors.muted,
                margin: 0,
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {today} &middot; Hi {userName ?? 'Researcher'}!
            </Text>
          </Section>

          <Hr style={{ borderColor: colors.border, marginBottom: '24px' }} />

          {/* === PAPERS === */}
          {papers.map((paper, idx) => (
            <Section
              key={paper.id}
              style={{
                backgroundColor: colors.cardBg,
                borderRadius: '8px',
                padding: '16px',
                marginBottom: idx < papers.length - 1 ? '16px' : '0',
                border: `1px solid ${colors.border}`,
              }}
            >
              <Row>
                <Column style={{ width: '48px', verticalAlign: 'top' }}>
                  {/* Gravity score badge */}
                  <Text
                    style={{
                      backgroundColor: getGravityColor(paper.gravity_score),
                      color: '#000',
                      fontSize: '14px',
                      fontWeight: 700,
                      textAlign: 'center',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      margin: 0,
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    {Math.round(paper.gravity_score)}
                  </Text>
                </Column>
                <Column style={{ paddingLeft: '12px' }}>
                  {/* Paper title */}
                  <Link
                    href={`${baseUrl}/paper/${paper.id}`}
                    style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: colors.text,
                      textDecoration: 'none',
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    {paper.title}
                  </Link>
                  {/* TLDR */}
                  {paper.tldr && (
                    <Text
                      style={{
                        fontSize: '14px',
                        color: colors.muted,
                        margin: '8px 0 0 0',
                        lineHeight: '1.5',
                        fontFamily:
                          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      }}
                    >
                      {paper.tldr}
                    </Text>
                  )}
                  {/* Categories + date */}
                  <Text
                    style={{
                      fontSize: '12px',
                      color: colors.muted,
                      margin: '8px 0 0 0',
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    {paper.categories.slice(0, 3).join(' · ')}{' '}
                    &middot; {formatDate(paper.published_at)}
                  </Text>
                </Column>
              </Row>
            </Section>
          ))}

          {/* === FOOTER === */}
          <Hr
            style={{
              borderColor: colors.border,
              marginTop: '32px',
              marginBottom: '16px',
            }}
          />
          <Section style={{ textAlign: 'center' }}>
            <Text
              style={{
                fontSize: '12px',
                color: colors.muted,
                margin: '0 0 8px 0',
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              <Link
                href={unsubscribeUrl}
                style={{ color: colors.muted, textDecoration: 'underline' }}
              >
                Unsubscribe
              </Link>{' '}
              &middot;{' '}
              <Link
                href={`${baseUrl}/settings`}
                style={{ color: colors.muted, textDecoration: 'underline' }}
              >
                Email Settings
              </Link>
            </Text>
            <Text
              style={{
                fontSize: '12px',
                color: colors.muted,
                margin: 0,
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Powered by PaperRadar
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// === RENDER HELPER ===

/**
 * Render the digest email to an HTML string.
 * Used by send-digest.ts to generate the email body.
 */
export async function renderDigestEmail(
  props: DigestEmailProps
): Promise<string> {
  return render(<DigestEmail {...props} />)
}
