#!/bin/bash
# Debug script for visit sending issues

echo "=== Visit Sending Diagnostics ==="
echo ""

echo "1. Checking users exist..."
sqlite3 server/server.db "SELECT id, username FROM users WHERE username IN ('alice', 'bob');"
echo ""

echo "2. Checking friendship status..."
ALICE_ID=$(sqlite3 server/server.db "SELECT id FROM users WHERE username='alice';")
BOB_ID=$(sqlite3 server/server.db "SELECT id FROM users WHERE username='bob';")

echo "Alice ID: $ALICE_ID"
echo "Bob ID: $BOB_ID"
echo ""

sqlite3 server/server.db "SELECT id, requester_id, addressee_id, status FROM friendships WHERE (requester_id IN ($ALICE_ID, $BOB_ID) OR addressee_id IN ($ALICE_ID, $BOB_ID));"
echo ""

echo "3. Checking active Pokemon..."
sqlite3 ~/Library/Application\ Support/Electron/pokepals.db "SELECT id, species, active_pokemon FROM pokemon;"
echo ""

echo "4. Checking for any existing visits..."
sqlite3 server/server.db "SELECT id, visiting_user_id, host_user_id, pokemon_species, created_at, expires_at, ended_at FROM visits WHERE visiting_user_id IN ($ALICE_ID, $BOB_ID) OR host_user_id IN ($ALICE_ID, $BOB_ID) ORDER BY created_at DESC LIMIT 5;"
echo ""

echo "5. Testing manual visit creation..."
echo "Creating test visit: alice (ID $ALICE_ID) visiting bob (ID $BOB_ID)..."

# Get alice's token (need to login first)
echo ""
echo "To test manually, run:"
echo "ALICE_TOKEN=\$(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"alice\",\"password\":\"test1234\"}' | jq -r '.token')"
echo "curl -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"alice\",\"password\":\"test1234\"}'"
echo ""
echo "curl -X POST http://localhost:3000/api/visits \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer \$ALICE_TOKEN' \\"
echo "  -d '{\"host_user_id\": $BOB_ID, \"pokemon_species\": \"charmander\"}'"
echo ""
echo "Expected: 201 response with visitId and expiresAt"
echo "If 403: Not friends"
echo "If 400: Invalid request (check host_user_id is number, pokemon_species is valid)"
