export type EventStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface EventMessage {
  eventId: string;
  taskId: string;
  timestamp: string;
  sender: string;
  receiver: string;
  status: EventStatus;
  message: string;
  metadata?: any;
}
