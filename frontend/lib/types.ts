export interface Plan {
  id: number;
  plan_name: string;
  monthly_price: number | string;
  max_employees: number;
  included_modules: string | null;
  trial_period_days: number;
  status: string;
  created_at: string;
}

export interface Company {
  id: number;
  company_name: string;
  admin_name: string;
  admin_email: string;
  phone: string | null;
  plan_id: number;
  database_type: string | null;
  database_name: string | null;
  status: string;
  approved_by: number | null;
  approved_at: string | null;
  created_at: string;
}

export interface User {
  id: number;
  company_id: number | null;
  name: string;
  email: string;
  role: string;
  is_temp_password: boolean;
  status: string;
  last_login: string | null;
  created_at: string;
}

export interface Subscription {
  id: number;
  company_id: number;
  plan_id: number;
  start_date: string;
  end_date: string;
  status: string;
  auto_renew: boolean;
  created_at: string;
}

export interface Payment {
  id: number;
  company_id: number;
  subscription_id: number;
  invoice_number: string;
  amount: number | string;
  payment_method: string | null;
  transaction_id: string | null;
  status: string;
  payment_date: string | null;
  created_at: string;
}

export interface Ticket {
  id: number;
  company_id: number;
  raised_by: number;
  subject: string;
  description: string | null;
  priority: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

export interface Notification {
  id: number;
  company_id: number | null;
  user_id: number | null;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  sent_at: string | null;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  module: string;
  description: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface Setting {
  setting_key: string;
  setting_value: string | null;
  description: string | null;
  updated_at: string | null;
}

export interface Dashboard {
  total_companies: number;
  active_companies: number;
  pending_companies: number;
  suspended_companies: number;
  total_users: number;
  monthly_revenue: number | string;
  open_tickets: number;
  expiring_soon: Subscription[];
}
