/**
 * Email Connector Module (SendGrid Integration)
 * Handles inbound support email parsing and ticket creation
 * Manages outbound support email replies
 */

import dotenv from 'dotenv';

dotenv.config();

export interface InboundEmail {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  timestamp: Date;
  attachments?: { filename: string; url: string }[];
}

export interface OutboundEmailRequest {
  to: string;
  subject: string;
  body: string;
  ticketId: string;
  cc?: string;
  attachments?: { filename: string; content: string }[];
}

export interface EmailDeliveryStatus {
  messageId: string;
  status: 'queued' | 'delivered' | 'bounce' | 'dropped' | 'deferred';
  timestamp: Date;
  error?: string;
}

class EmailConnector {
  private sendgridApiKey?: string;
  private supportEmail: string;
  private emailQueue: Map<string, OutboundEmailRequest> = new Map();

  constructor() {
    this.sendgridApiKey = process.env.SENDGRID_API_KEY;
    this.supportEmail = process.env.SUPPORT_EMAIL || 'support@example.com';
  }

  /**
   * Parse inbound webhook from SendGrid Inbound Parse
   * Converts email to support ticket
   */
  async parseInboundEmail(payload: any): Promise<InboundEmail> {
    // Extract from SendGrid webhook format
    const email: InboundEmail = {
      messageId: payload.msg_id || `msg_${Date.now()}`,
      from: payload.from || '',
      to: payload.to || this.supportEmail,
      subject: payload.subject || '(No Subject)',
      text: payload.text || '',
      html: payload.html,
      timestamp: new Date(),
      attachments: this.parseAttachments(payload.attachments),
    };

    return email;
  }

  /**
   * Parse attachments from email payload
   */
  private parseAttachments(attachmentsPayload: any): any[] {
    if (!attachmentsPayload) return [];

    // Parse multiple attachment format
    const attachments = [];
    const attachmentCount = parseInt(attachmentsPayload.attachment_count || '0');

    for (let i = 1; i <= attachmentCount; i++) {
      const filename = attachmentsPayload[`attachment${i}_filename`];
      const url = attachmentsPayload[`attachment${i}_url`];
      if (filename && url) {
        attachments.push({ filename, url });
      }
    }

    return attachments;
  }

  /**
   * Queue outbound support email
   */
  async queueOutboundEmail(request: OutboundEmailRequest): Promise<{ queued: true; id: string }> {
    const id = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.emailQueue.set(id, request);

    // In production, would send via SendGrid API
    // For now, we queue it and return success
    return { queued: true, id };
  }

  /**
   * Send email via SendGrid
   */
  async sendEmail(request: OutboundEmailRequest): Promise<EmailDeliveryStatus> {
    if (!this.sendgridApiKey) {
      return {
        messageId: `msg_${Date.now()}`,
        status: 'deferred',
        timestamp: new Date(),
        error: 'SendGrid API key not configured',
      };
    }

    try {
      // In production, would call SendGrid API
      // const response = await sgMail.send({
      //   to: request.to,
      //   from: this.supportEmail,
      //   subject: request.subject,
      //   text: request.body,
      //   cc: request.cc,
      //   attachments: request.attachments,
      // });

      return {
        messageId: `msg_${Date.now()}`,
        status: 'delivered',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        messageId: `msg_${Date.now()}`,
        status: 'bounce',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get queued emails
   */
  getQueuedEmails(): Map<string, OutboundEmailRequest> {
    return this.emailQueue;
  }

  /**
   * Process email queue
   */
  async processQueue(): Promise<EmailDeliveryStatus[]> {
    const results: EmailDeliveryStatus[] = [];

    for (const [id, email] of this.emailQueue) {
      const status = await this.sendEmail(email);
      results.push(status);

      if (status.status === 'delivered') {
        this.emailQueue.delete(id);
      }
    }

    return results;
  }

  /**
   * Validate email address format
   */
  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Extract email domain
   */
  getEmailDomain(email: string): string {
    const parts = email.split('@');
    return parts.length === 2 ? parts[1] : '';
  }
}

export default new EmailConnector();
