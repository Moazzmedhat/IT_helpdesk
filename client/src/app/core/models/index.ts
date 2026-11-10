export type Role = 'EMPLOYEE' | 'TECHNICIAN' | 'ADMIN';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING' | 'RESOLVED' | 'CLOSED' | 'REOPENED';

export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CommentVisibility = 'PUBLIC' | 'INTERNAL';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  department?: { id: string; name: string; code: string } | null;
  branch?: { id: string; name: string; code: string; city: string } | null;
  isActive?: boolean;
}

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  city: string;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  subcategories?: Subcategory[];
}

export interface Priority {
  level: PriorityLevel;
  name: string;
  color: string;
  slaResponseHours: number;
  slaResolveHours: number;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  requesterId: string;
  assignedToId?: string | null;
  departmentId: string;
  branchId: string;
  categoryId: string;
  subcategoryId?: string | null;
  priority: PriorityLevel;
  status: TicketStatus;
  deviceAssetTag?: string | null;
  version: number;
  claimedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  requester?: User;
  assignedTo?: User | null;
  department?: Department;
  branch?: Branch;
  category?: Category;
  subcategory?: Subcategory | null;
  history?: TicketHistory[];
}

export interface TicketHistory {
  id: string;
  ticketId: string;
  actorId: string;
  fromStatus: TicketStatus;
  toStatus: TicketStatus;
  reason?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    fullName: string;
    role: Role;
  };
}

export interface Comment {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  visibility: CommentVisibility;
  createdAt: string;
  author?: {
    id: string;
    fullName: string;
    email: string;
    role: Role;
  };
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  ticketId: string;
  commentId?: string | null;
  uploaderId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  scanStatus: 'PENDING' | 'CLEAN' | 'INFECTED';
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  ticketId?: string | null;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface Setting {
  key: string;
  value: string;
  description?: string;
}

export interface AuditLog {
  id: string;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
  };
}
