/**
 * @openapi
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       required:
 *         - error
 *         - message
 *       properties:
 *         error:
 *           type: string
 *           enum: [unauthorized, forbidden, not_found, validation_error, rate_limited, internal_error]
 *           description: Error code
 *         message:
 *           type: string
 *           description: Human-readable error message
 *       example:
 *         error: unauthorized
 *         message: Invalid or missing authentication token
 *
 *     HealthResponse:
 *       type: object
 *       required:
 *         - status
 *         - uptime
 *         - accounts
 *         - deadLetterCount
 *       properties:
 *         status:
 *           type: string
 *           enum: [ok]
 *           description: Service health status
 *         uptime:
 *           type: number
 *           description: Service uptime in seconds
 *           example: 3600
 *         accounts:
 *           type: object
 *           required:
 *             - connected
 *             - total
 *           properties:
 *             connected:
 *               type: number
 *               description: Number of connected email accounts
 *               example: 2
 *             total:
 *               type: number
 *               description: Total number of configured email accounts
 *               example: 3
 *         deadLetterCount:
 *           type: number
 *           description: Number of emails in dead letter queue
 *           example: 5
 *         lastProcessed:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Timestamp of last processed email
 *           example: "2026-01-21T10:30:00.000Z"
 *         tika:
 *           type: object
 *           description: Apache Tika service status (if enabled)
 *           properties:
 *             available:
 *               type: boolean
 *               description: Whether Tika service is reachable
 *             url:
 *               type: string
 *               description: Tika service URL
 *               example: "http://localhost:9998"
 *         clamav:
 *           type: object
 *           description: ClamAV antivirus status (if enabled)
 *           properties:
 *             available:
 *               type: boolean
 *               description: Whether ClamAV is available
 *             host:
 *               type: string
 *               description: ClamAV host
 *               example: "localhost"
 *             port:
 *               type: number
 *               description: ClamAV port
 *               example: 3310
 *
 *     AccountStatus:
 *       type: object
 *       required:
 *         - name
 *         - connected
 *         - lastSync
 *         - emailsProcessed
 *       properties:
 *         name:
 *           type: string
 *           description: Account name
 *           example: "personal"
 *         connected:
 *           type: boolean
 *           description: Whether account is connected
 *         lastSync:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Last successful sync timestamp
 *         emailsProcessed:
 *           type: number
 *           description: Total emails processed for this account
 *           example: 1234
 *         error:
 *           type: string
 *           nullable: true
 *           description: Last error message (if any)
 *
 *     AuditEntry:
 *       type: object
 *       required:
 *         - id
 *         - accountName
 *         - messageId
 *         - actions
 *         - createdAt
 *       properties:
 *         id:
 *           type: integer
 *           description: Audit entry ID
 *           example: 42
 *         accountName:
 *           type: string
 *           description: Email account name
 *           example: "personal"
 *         messageId:
 *           type: string
 *           description: Email message ID
 *           example: "<abc123@gmail.com>"
 *         actions:
 *           type: string
 *           description: JSON array of actions taken
 *           example: "[{\"type\":\"move\",\"folder\":\"Archive\"}]"
 *         llmProvider:
 *           type: string
 *           nullable: true
 *           description: LLM provider used
 *           example: "openai"
 *         llmModel:
 *           type: string
 *           nullable: true
 *           description: LLM model used
 *           example: "gpt-4o-mini"
 *         confidence:
 *           type: number
 *           nullable: true
 *           description: Classification confidence score
 *           example: 0.95
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the action was performed
 *
 *     DeadLetterEntry:
 *       type: object
 *       required:
 *         - id
 *         - accountName
 *         - messageId
 *         - error
 *         - createdAt
 *       properties:
 *         id:
 *           type: integer
 *           description: Dead letter entry ID
 *         accountName:
 *           type: string
 *           description: Email account name
 *         messageId:
 *           type: string
 *           description: Email message ID
 *         error:
 *           type: string
 *           description: Error message
 *         retryCount:
 *           type: integer
 *           description: Number of retry attempts
 *           example: 3
 *         lastRetry:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Last retry timestamp
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the error occurred
 *
 *   securitySchemes:
 *     SessionAuth:
 *       type: apiKey
 *       in: cookie
 *       name: session
 *       description: Session cookie from /api/login
 *     ApiKeyAuth:
 *       type: apiKey
 *       in: header
 *       name: Authorization
 *       description: API key in format "Bearer YOUR_API_KEY" (future feature)
 */

// This file only contains JSDoc comments for OpenAPI schema generation
// No runtime code needed
export {};
