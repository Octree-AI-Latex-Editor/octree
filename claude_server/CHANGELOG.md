# Changelog

All notable changes to the Octree Agent Server will be documented in this file.

## [1.0.0] - 2025-10-08

### Added
- Initial release of standalone Claude Agent server
- Express-based HTTP server with SSE streaming
- Integration with Claude Agent SDK v0.1.5
- MCP (Model Context Protocol) tools:
  - `get_context` - Retrieve file context
  - `propose_edits` - Suggest LaTeX edits
- AST-based edit validation
- Intent inference for edit safety
- Systemd service configuration
- Deployment scripts:
  - `setup.sh` - First-time server setup
  - `deploy.sh` - Update deployment
  - `logs.sh` - View live logs
  - `status.sh` - Check service status
- Comprehensive README documentation
- TypeScript support with tsx
- CORS support for cross-origin requests

### Server Specifications
- Node.js 18+ runtime
- Port 8787 (configurable)
- Non-root user execution (octra)
- Auto-restart on failure
- Production-ready error handling

### Dependencies
- @anthropic-ai/claude-agent-sdk: ^0.1.5
- express: ^5.1.0
- cors: ^2.8.5
- zod: ^3.25.76

### Security Features
- Non-root service user
- Systemd service isolation
- Environment variable configuration
- Working directory permissions

### Known Issues
- No authentication on API endpoint
- No rate limiting
- No HTTPS/TLS support
- API key stored in systemd override (plaintext)
- Debug mode enabled in production

### Future Improvements
- [ ] Add JWT/API key authentication
- [ ] Implement rate limiting per IP/user
- [ ] Set up HTTPS with reverse proxy
- [ ] Add edit limit checking
- [ ] Add Stripe subscription validation
- [ ] Implement request logging
- [ ] Add performance monitoring
- [ ] Secure API key storage (secrets manager)
- [ ] Add health check endpoint
- [ ] Implement graceful shutdown

---

## Version History

- **1.0.0** (2025-10-08) - Initial release with core functionality

