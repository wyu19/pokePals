#!/bin/bash
# Manual test script for Add Friend dialog (M004/S03/T02)
# 
# Prerequisites:
# 1. Backend server running on port 3000
# 2. Users created: ash_ketchum, misty_cascade, brock_harrison
# 3. Electron app running and logged in as ash_ketchum
#
# Expected behavior:
# 1. Right-click context menu shows Friends submenu with "Add Friend" option
# 2. Click "Add Friend" opens dialog with search input
# 3. Type "misty" in search, wait 300ms, results appear
# 4. Click "Add Friend" button next to misty_cascade
# 5. Request sent, dialog closes, success alert shown
# 6. Verify in database that friend request exists

echo "=== Add Friend Dialog Test ==="
echo ""
echo "Backend server status:"
curl -s http://localhost:3000/api/auth/register -X POST -H "Content-Type: application/json" -d '{}' > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Backend server is running on port 3000"
else
  echo "✗ Backend server not running. Start with: cd server && node index.js"
  exit 1
fi

echo ""
echo "Checking test users..."
cd server
USERS=$(sqlite3 server.db "SELECT username FROM users WHERE username IN ('ash_ketchum', 'misty_cascade', 'brock_harrison') ORDER BY username;")
cd ..

if echo "$USERS" | grep -q "ash_ketchum"; then
  echo "✓ ash_ketchum exists"
else
  echo "✗ ash_ketchum missing"
fi

if echo "$USERS" | grep -q "misty_cascade"; then
  echo "✓ misty_cascade exists"
else
  echo "✗ misty_cascade missing"
fi

if echo "$USERS" | grep -q "brock_harrison"; then
  echo "✓ brock_harrison exists"
else
  echo "✗ brock_harrison missing"
fi

echo ""
echo "=== Manual Test Steps ==="
echo "1. Open Electron app (npm start)"
echo "2. Login as ash_ketchum / password123"
echo "3. Right-click on the Pokemon sprite"
echo "4. Navigate to Friends > Add Friend"
echo "5. In the dialog, type 'misty' in the search box"
echo "6. Wait 300ms - verify 'misty_cascade' appears in results"
echo "7. Click 'Add Friend' button next to misty_cascade"
echo "8. Verify success alert appears"
echo "9. Check DevTools console for logs:"
echo "   - '[Friends] Search: q=\"misty\", found 1 results'"
echo "   - '[Friends] Friend request sent successfully'"
echo ""
echo "=== Verification Commands ==="
echo "After sending request, run these to verify database state:"
echo ""
echo "# Check friend_requests table:"
echo "sqlite3 server/server.db \"SELECT requester_id, addressee_id, status FROM friend_requests;\""
echo ""
echo "# Check with usernames:"
echo "sqlite3 server/server.db \"SELECT u1.username as requester, u2.username as addressee, fr.status FROM friend_requests fr JOIN users u1 ON fr.requester_id = u1.id JOIN users u2 ON fr.addressee_id = u2.id;\""
echo ""
