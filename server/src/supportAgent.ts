/**
 * Support Agent Module
 * Handles auto-drafting of support ticket replies using DB lookups
 * Integrates with LLM routing for response generation
 */

import dbConnector, { SupportTicket, UserRecord } from './dbConnector';
import { routePromptToLLM } from './llmRouter';

export interface SupportDraftRequest {
  ticketId: string;
  tone?: 'professional' | 'friendly' | 'technical';
  includeResolution?: boolean;
}

export interface SupportDraft {
  ticketId: string;
  draftText: string;
  suggestedNextStep: string;
  confidence: number;
  requiresHumanReview: boolean;
}

class SupportAgent {
  private model: string = process.env.SUPPORT_MODEL || 'gpt-3.5-turbo';

  /**
   * Generate auto-draft response for a support ticket
   */
  async generateTicketDraft(request: SupportDraftRequest): Promise<SupportDraft> {
    try {
      // Fetch ticket details
      const ticketDetails = await dbConnector.getTicketDetails(request.ticketId);
      const ticket = ticketDetails;
      const user = ticketDetails.user;

      // Fetch user history for context
      const userDetails = await dbConnector.getUserDetails(user.id);

      // Build context for LLM
      const context = this.buildTicketContext(ticket, userDetails);

      // Route to LLM for draft generation
      const prompt = this.buildDraftPrompt(context, request.tone || 'professional');
      const llmResponse = await routePromptToLLM(prompt);

      // Parse LLM response
      const draft = this.parseLLMResponse(llmResponse.response);

      return {
        ticketId: request.ticketId,
        draftText: draft.text,
        suggestedNextStep: draft.nextStep,
        confidence: draft.confidence,
        requiresHumanReview: draft.requiresReview,
      };
    } catch (error) {
      console.error('Error generating support draft:', error);
      return {
        ticketId: request.ticketId,
        draftText: 'Unable to generate draft. Please reply manually.',
        suggestedNextStep: 'Escalate to senior support',
        confidence: 0,
        requiresHumanReview: true,
      };
    }
  }

  /**
   * Build context string from ticket and user data
   */
  private buildTicketContext(ticket: SupportTicket, userDetails: any): string {
    return `
USER CONTEXT:
- Name: ${userDetails.name}
- Email: ${userDetails.email}
- Status: ${userDetails.status}
- Account Created: ${userDetails.createdAt}
- Last Login: ${userDetails.lastLogin}
- Plan: ${userDetails.metadata?.plan || 'unknown'}
- Recent Activity: ${userDetails.activityHistory?.length || 0} events

TICKET DETAILS:
- ID: ${ticket.id}
- Priority: ${ticket.priority}
- Status: ${ticket.status}
- Subject: ${ticket.subject}
- Message: ${ticket.body}
- Created: ${ticket.createdAt}
- Days Open: ${this.daysSince(ticket.createdAt)}
    `.trim();
  }

  /**
   * Build prompt for LLM draft generation
   */
  private buildDraftPrompt(context: string, tone: string): string {
    return `You are a professional support agent. Based on the following context, draft a concise, empathetic support response.

TONE: ${tone}

CONTEXT:
${context}

INSTRUCTIONS:
1. Address the customer by their first name if available
2. Acknowledge their issue
3. Provide a clear solution or next steps
4. Keep response under 150 words
5. Be professional and helpful
6. If issue requires escalation, suggest it

Respond in this format:
DRAFT: [your response here]
NEXT_STEP: [what happens next]
CONFIDENCE: [0-100 how confident are you this will resolve it]
REQUIRES_REVIEW: [true/false if human should review]`;
  }

  /**
   * Parse LLM response into structured draft
   */
  private parseLLMResponse(response: string): {
    text: string;
    nextStep: string;
    confidence: number;
    requiresReview: boolean;
  } {
    const draftMatch = response.match(/DRAFT:\s*([\s\S]*?)(?=NEXT_STEP:|$)/);
    const nextStepMatch = response.match(/NEXT_STEP:\s*([\s\S]*?)(?=CONFIDENCE:|$)/);
    const confidenceMatch = response.match(/CONFIDENCE:\s*(\d+)/);
    const reviewMatch = response.match(/REQUIRES_REVIEW:\s*(true|false)/i);

    return {
      text: draftMatch ? draftMatch[1].trim() : response,
      nextStep: nextStepMatch ? nextStepMatch[1].trim() : 'Await customer response',
      confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 75,
      requiresReview: reviewMatch ? reviewMatch[1].toLowerCase() === 'true' : false,
    };
  }

  /**
   * Calculate days since date
   */
  private daysSince(date: Date | undefined): number {
    if (!date) return 0;
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Get suggested responses for common issues
   */
  async getSuggestedResponses(ticketId: string): Promise<string[]> {
    const ticket = await dbConnector.getTicketDetails(ticketId);

    // Map common keywords to pre-written responses
    const keywordResponses: Record<string, string[]> = {
      password: [
        'Have you tried resetting your password using the "Forgot Password" link?',
        'Please check your email for the password reset link. It may take a few minutes to arrive.',
      ],
      login: [
        'Try clearing your browser cache and cookies, then attempt login again.',
        'Are you using the correct email address associated with your account?',
      ],
      billing: [
        'Your invoice is available in your account settings under Billing.',
        'If you have questions about charges, please reply with your invoice number.',
      ],
      feature: [
        'Thank you for the suggestion! We appreciate your feedback.',
        'This feature request has been forwarded to our product team for consideration.',
      ],
      error: [
        'I apologize for the inconvenience. Can you provide the error message or screenshot?',
        'Please try the following: [1. Clear cache 2. Disable extensions 3. Try incognito mode]',
      ],
    };

    const keywords = ticket.subject.toLowerCase().split(/\s+/);
    const responses: Set<string> = new Set();

    for (const keyword of keywords) {
      if (keywordResponses[keyword]) {
        keywordResponses[keyword].forEach((r) => responses.add(r));
      }
    }

    return Array.from(responses).slice(0, 3);
  }
}

export default new SupportAgent();
