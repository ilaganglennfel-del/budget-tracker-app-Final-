const { z } = require('zod');

/**
 * Returns an Express middleware that validates req.body against a Zod schema.
 * On failure, responds with 400 + field-level error details.
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field:   e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', details: errors },
      });
    }
    req.body = result.data; // use the parsed (sanitized) data going forward
    next();
  };
}

// ── Schemas ─────────────────────────────────────────────────

const registerSchema = z.object({
  email:      z.string().email('Must be a valid email').max(255),
  password:   z.string().min(8, 'Password must be at least 8 characters').max(128),
  first_name: z.string().min(1).max(100).trim(),
  last_name:  z.string().min(1).max(100).trim(),
});

const loginSchema = z.object({
  email:    z.string().email().max(255),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

const transferSchema = z.object({
  receiver_email: z.string().email().max(255),
  amount:         z.number().positive('Amount must be positive').max(1_000_000),
  note:           z.string().max(200).optional(),
});

const depositSchema = z.object({
  amount: z.number().positive('Amount must be positive').max(1_000_000),
});

const goalCreateSchema = z.object({
  name:          z.string().min(1).max(100).trim(),
  target_amount: z.number().positive().max(10_000_000),
  target_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  emoji:         z.string().max(10).optional(),
});

const goalUpdateSchema = z.object({
  name:           z.string().min(1).max(100).trim().optional(),
  target_amount:  z.number().positive().max(10_000_000).optional(),
  current_amount: z.number().min(0).max(10_000_000).optional(),
  target_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  emoji:          z.string().max(10).optional(),
});

const searchEmailSchema = z.object({
  email: z.string().email().max(255),
});

module.exports = {
  validate,
  schemas: {
    register:     registerSchema,
    login:        loginSchema,
    refresh:      refreshSchema,
    transfer:     transferSchema,
    deposit:      depositSchema,
    goalCreate:   goalCreateSchema,
    goalUpdate:   goalUpdateSchema,
    searchEmail:  searchEmailSchema,
  },
};
