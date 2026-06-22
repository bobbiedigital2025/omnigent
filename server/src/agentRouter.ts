import { EventMessage } from './types';

export type AgentTaskType = 'scaffold' | 'hotfix' | 'draft_assist';

export interface AgentTask {
  type: AgentTaskType;
  payload?: Record<string, any>;
}

export const routeAgentTask = async (task: AgentTask, emitEvent: (event: EventMessage) => void) => {
  switch (task.type) {
    case 'scaffold':
      return scaffoldAgent(task.payload, emitEvent);
    case 'hotfix':
      return hotfixAgent(task.payload, emitEvent);
    case 'draft_assist':
      return draftAssistAgent(task.payload, emitEvent);
    default:
      emitEvent({
        eventId: `evt_${Date.now()}`,
        taskId: task.payload?.taskId || 'task_unknown',
        timestamp: new Date().toISOString(),
        sender: 'Agent Router',
        receiver: 'blackboard',
        status: 'FAILED',
        message: `Unknown agent task type: ${task.type}`
      });
  }
};

const scaffoldAgent = async (payload: Record<string, any> = {}, emitEvent: (event: EventMessage) => void) => {
  emitEvent({
    eventId: `evt_${Date.now()}`,
    taskId: payload.taskId || `task_${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    sender: 'Scaffold Agent',
    receiver: 'blackboard',
    status: 'IN_PROGRESS',
    message: 'Scaffold Agent is preparing the application structure.'
  });

  await new Promise(resolve => setTimeout(resolve, 1200));

  emitEvent({
    eventId: `evt_${Date.now()}`,
    taskId: payload.taskId || 'task_scaffold',
    timestamp: new Date().toISOString(),
    sender: 'Scaffold Agent',
    receiver: 'blackboard',
    status: 'COMPLETED',
    message: 'Scaffold Agent completed the app skeleton and environment setup.'
  });
};

const hotfixAgent = async (payload: Record<string, any> = {}, emitEvent: (event: EventMessage) => void) => {
  emitEvent({
    eventId: `evt_${Date.now()}`,
    taskId: payload.taskId || `task_${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    sender: 'Coder Agent',
    receiver: 'blackboard',
    status: 'IN_PROGRESS',
    message: 'Coder Agent is analyzing logs and code for the hotfix.'
  });

  await new Promise(resolve => setTimeout(resolve, 1400));

  emitEvent({
    eventId: `evt_${Date.now()}`,
    taskId: payload.taskId || 'task_hotfix',
    timestamp: new Date().toISOString(),
    sender: 'Coder Agent',
    receiver: 'blackboard',
    status: 'COMPLETED',
    message: 'Coder Agent applied the hotfix and verified the patch in the event stream.'
  });
};

const draftAssistAgent = async (payload: Record<string, any> = {}, emitEvent: (event: EventMessage) => void) => {
  emitEvent({
    eventId: `evt_${Date.now()}`,
    taskId: payload.taskId || `task_${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    sender: 'Support Agent',
    receiver: 'blackboard',
    status: 'IN_PROGRESS',
    message: 'Support Agent is drafting a response for the ticket.'
  });

  await new Promise(resolve => setTimeout(resolve, 900));

  emitEvent({
    eventId: `evt_${Date.now()}`,
    taskId: payload.taskId || 'task_draft',
    timestamp: new Date().toISOString(),
    sender: 'Support Agent',
    receiver: 'blackboard',
    status: 'COMPLETED',
    message: 'Support Agent completed the draft assist and sent the proposed reply.',
    metadata: { ticketId: payload.ticketId }
  });
};
