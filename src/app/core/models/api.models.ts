export type Role = 'USER' | 'SUBSCRIBER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  /** assente per gli account creati prima dell'introduzione del nickname */
  nickname?: string;
  role: Role;
  verified: boolean;
}

export interface AuthResponse {
  accessToken: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  nickname: string;
}

export type LessonVisibility = 'USER' | 'SUBSCRIBER';

export interface Lesson {
  id: string;
  title: string;
  description: string;
  tags: string[];
  visibility: LessonVisibility;
  /** true se il ruolo corrente non sblocca il video (vimeoEmbedUrl assente) */
  locked: boolean;
  vimeoEmbedUrl?: string;
  createdAt?: string;
}

export interface LessonPayload {
  title: string;
  description: string;
  vimeoEmbedUrl: string;
  tags: string[];
  visibility: LessonVisibility;
}

export interface News {
  _id: string;
  title: string;
  body: string;
  coverImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewsPayload {
  title: string;
  body: string;
  coverImageUrl?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
