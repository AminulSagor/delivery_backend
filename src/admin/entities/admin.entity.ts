export interface Admin {
  id: number;
  name: string;
  email: string;
  role: 'super-admin' | 'admin' | 'moderator';
  createdAt: Date;
}
