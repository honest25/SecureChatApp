import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(2),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  room_number: z.string().min(1),
  hostel_name: z.string().min(1),
  mobile: z.string().optional(),
  profession: z.enum(['STUDENT', 'PROFESSIONAL']),
  college_name: z.string().optional(),
  college_location: z.string().optional(),
  company_name: z.string().optional(),
  company_location: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  device_info: z.string().optional(),
});
