/**
 * Comprehensive OpenAPI documentation for all dashboard routes
 *
 * This file contains JSDoc @openapi comments for all API endpoints.
 * The generate-api-docs script will parse these to create documentation.
 */

/**
 * @openapi
 * /api/auth:
 *   get:
 *     summary: Check authentication status
 *     description: Returns current user information if authenticated, or null if not authenticated
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Authentication status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                 setupRequired:
 *                   type: boolean
 *                   description: Whether initial setup is needed
 *             examples:
 *               authenticated:
 *                 value:
 *                   user: { id: 1, username: "admin" }
 *                   setupRequired: false
 *               not_authenticated:
 *                 value:
 *                   user: null
 *                   setupRequired: false
 */

/**
 * @openapi
 * /api/setup:
 *   post:
 *     summary: Initial setup - create first user
 *     description: Creates the first admin user. Only available when no users exist.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: User created successfully
 *       400:
 *         description: Setup already completed or validation error
 *       500:
 *         description: Internal server error
 */

/**
 * @openapi
 * /api/login:
 *   post:
 *     summary: Login with username and password
 *     description: Authenticates user and creates session cookie
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *             description: Session cookie
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many failed attempts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 retryAfter:
 *                   type: integer
 *                   description: Seconds until retry allowed
 */

/**
 * @openapi
 * /api/logout:
 *   post:
 *     summary: Logout current session
 *     description: Destroys session and clears cookie
 *     tags: [Authentication]
 *     security:
 *       - SessionAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */

/**
 * @openapi
 * /api/stats:
 *   get:
 *     summary: Get email processing statistics
 *     description: Returns processing stats including email counts, action breakdown, and provider statistics
 *     tags: [Statistics]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [hour, day, week, month, all]
 *         description: Time period for stats
 *     responses:
 *       200:
 *         description: Statistics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version:
 *                   type: string
 *                 uptime:
 *                   type: number
 *                 dryRun:
 *                   type: boolean
 *                 totals:
 *                   type: object
 *                   properties:
 *                     emailsProcessed:
 *                       type: number
 *                     actionsTaken:
 *                       type: number
 *                     errors:
 *                       type: number
 *                 accounts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AccountStatus'
 *                 actionBreakdown:
 *                   type: object
 *                   additionalProperties:
 *                     type: number
 *                 providerStats:
 *                   type: array
 *                 queueStatus:
 *                   type: object
 *                 deadLetterCount:
 *                   type: number
 */

/**
 * @openapi
 * /api/activity:
 *   get:
 *     summary: Get audit log entries
 *     description: Returns paginated audit log of processed emails
 *     tags: [Activity]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - name: pageSize
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *       - name: account
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by account name
 *     responses:
 *       200:
 *         description: Audit log entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entries:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditEntry'
 *                 total:
 *                   type: number
 *                 page:
 *                   type: number
 *                 pageSize:
 *                   type: number
 *                 hasMore:
 *                   type: boolean
 */

/**
 * @openapi
 * /api/logs:
 *   get:
 *     summary: Get application logs
 *     description: Returns paginated application logs with filtering
 *     tags: [Logs]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: level
 *         in: query
 *         schema:
 *           type: string
 *           enum: [error, warn, info, debug]
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Log entries
 */

/**
 * @openapi
 * /api/export:
 *   get:
 *     summary: Export audit log as CSV
 *     description: Downloads audit log in CSV format
 *     tags: [Export]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: account
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */

/**
 * @openapi
 * /api/accounts/{name}/pause:
 *   post:
 *     summary: Pause email processing for account
 *     description: Temporarily stops processing emails for the specified account
 *     tags: [Accounts]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: name
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account paused
 *       404:
 *         description: Account not found
 */

/**
 * @openapi
 * /api/accounts/{name}/resume:
 *   post:
 *     summary: Resume email processing for account
 *     description: Resumes processing emails for a paused account
 *     tags: [Accounts]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: name
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account resumed
 */

/**
 * @openapi
 * /api/accounts/{name}/reconnect:
 *   post:
 *     summary: Reconnect IMAP connection for account
 *     description: Forces reconnection to IMAP server
 *     tags: [Accounts]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: name
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reconnection initiated
 */

/**
 * @openapi
 * /api/accounts/{name}/process:
 *   post:
 *     summary: Trigger manual processing for account
 *     description: Manually triggers email processing without waiting for IDLE
 *     tags: [Accounts]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: name
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Processing triggered
 */

/**
 * @openapi
 * /api/test-classification:
 *   post:
 *     summary: Test email classification with LLM
 *     description: Tests classification prompt against sample email content
 *     tags: [Testing]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [provider, prompt, emailContent]
 *             properties:
 *               provider:
 *                 type: string
 *               prompt:
 *                 type: string
 *               emailContent:
 *                 type: object
 *                 properties:
 *                   from:
 *                     type: string
 *                   to:
 *                     type: string
 *                   subject:
 *                     type: string
 *                   body:
 *                     type: string
 *     responses:
 *       200:
 *         description: Classification result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 actions:
 *                   type: array
 *                 confidence:
 *                   type: number
 *                 reasoning:
 *                   type: string
 *                 tokenUsage:
 *                   type: object
 *                 latency:
 *                   type: number
 */

/**
 * @openapi
 * /api/dead-letter:
 *   get:
 *     summary: Get dead letter queue entries
 *     description: Returns failed emails in dead letter queue
 *     tags: [Dead Letter]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Dead letter entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DeadLetterEntry'
 */

/**
 * @openapi
 * /api/dead-letter/{id}/retry:
 *   post:
 *     summary: Retry failed email
 *     description: Retries processing a failed email from dead letter queue
 *     tags: [Dead Letter]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Retry initiated
 */

/**
 * @openapi
 * /api/dead-letter/{id}/dismiss:
 *   post:
 *     summary: Dismiss failed email
 *     description: Removes email from dead letter queue without retrying
 *     tags: [Dead Letter]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Entry dismissed
 */

/**
 * @openapi
 * /api/config:
 *   get:
 *     summary: Get current configuration
 *     description: Returns parsed configuration object (sensitive values redacted)
 *     tags: [Configuration]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Configuration object
 *   put:
 *     summary: Update configuration
 *     description: Updates configuration and reloads
 *     tags: [Configuration]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Configuration updated
 */

/**
 * @openapi
 * /api/config/raw:
 *   get:
 *     summary: Get raw config.yaml content
 *     description: Returns raw YAML configuration file
 *     tags: [Configuration]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Raw YAML content
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *   put:
 *     summary: Update raw config.yaml
 *     description: Replaces config.yaml with new content
 *     tags: [Configuration]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         text/plain:
 *           schema:
 *             type: string
 *     responses:
 *       200:
 *         description: Configuration updated
 */

/**
 * @openapi
 * /api/test-imap:
 *   post:
 *     summary: Test IMAP connection
 *     description: Tests IMAP connection with provided credentials
 *     tags: [Testing]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [host, port, username, password]
 *             properties:
 *               host:
 *                 type: string
 *               port:
 *                 type: number
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               auth:
 *                 type: string
 *                 enum: [password, oauth2]
 *     responses:
 *       200:
 *         description: Connection successful
 *       400:
 *         description: Connection failed
 */

/**
 * @openapi
 * /api/test-llm:
 *   post:
 *     summary: Test LLM provider connection
 *     description: Tests connection to LLM provider with a simple prompt
 *     tags: [Testing]
 *     security:
 *       - SessionAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [provider]
 *             properties:
 *               provider:
 *                 type: object
 *     responses:
 *       200:
 *         description: Test successful
 */

// Export empty object to make this a valid module
export {};
