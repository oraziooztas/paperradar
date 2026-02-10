// welcome.tsx — Welcome email for new signups
// Deps: @react-email/components | Used by: auth webhook / post-signup flow
// Why: onboarding email with dark theme matching digest template

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
  Preview,
  render,
} from '@react-email/components'
import * as React from 'react'

// === TYPES ===

interface WelcomeEmailProps {
  userName: string
  loginUrl: string
}

// === STYLE CONSTANTS ===

const colors = {
  bg: '#030712',
  cardBg: '#111827',
  text: '#f3f4f6',
  muted: '#9ca3af',
  accent: '#6366f1',
  border: '#1f2937',
} as const

// === COMPONENT ===

export function WelcomeEmail({ userName, loginUrl }: WelcomeEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Welcome to PaperRadar — your AI research feed, personalized</Preview>
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
                margin: '0 0 16px 0',
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              PaperRadar
            </Text>
          </Section>

          {/* === BODY === */}
          <Section
            style={{
              backgroundColor: colors.cardBg,
              borderRadius: '8px',
              padding: '24px',
              border: `1px solid ${colors.border}`,
            }}
          >
            <Text
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: colors.text,
                margin: '0 0 16px 0',
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Welcome, {userName ?? 'Researcher'}!
            </Text>
            <Text
              style={{
                fontSize: '15px',
                color: colors.text,
                lineHeight: '1.6',
                margin: '0 0 16px 0',
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              PaperRadar surfaces the most impactful AI and ML research papers,
              ranked by our Gravity Score algorithm and personalized to your
              interests. No more endless scrolling through ArXiv.
            </Text>
            <Text
              style={{
                fontSize: '15px',
                color: colors.text,
                lineHeight: '1.6',
                margin: '0 0 24px 0',
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              To get the best recommendations, head to{' '}
              <Link
                href={`${loginUrl.replace(/\/$/, '')}/settings`}
                style={{ color: colors.accent, textDecoration: 'underline' }}
              >
                Settings
              </Link>{' '}
              and select the research categories you care about. This helps us
              tailor your daily digest and feed.
            </Text>

            {/* CTA Button */}
            <Section style={{ textAlign: 'center' }}>
              <Link
                href={loginUrl}
                style={{
                  display: 'inline-block',
                  backgroundColor: colors.accent,
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  borderRadius: '8px',
                  padding: '12px 32px',
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                Explore Your Feed
              </Link>
            </Section>
          </Section>

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
 * Render the welcome email to an HTML string.
 */
export async function renderWelcomeEmail(
  props: WelcomeEmailProps
): Promise<string> {
  return render(<WelcomeEmail {...props} />)
}
