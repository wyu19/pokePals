#!/bin/bash

# S02 Manual Verification Script

cd /Users/wenbinyu/pokePals

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  S02: Multi-Sprite Rendering - Final Verification            ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Kill any existing instances
pkill -f "electron.*pokePals" 2>/dev/null
sleep 1

# Launch app
echo "Launching PokePals..."
npm start &
sleep 7

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "MANUAL VERIFICATION STEPS:"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "1. Check if you see your Pokémon sprite on the desktop"
echo "   • Should be visible near coordinates (200, 200)"
echo "   • Should be animating (idle breathing animation)"
echo ""
echo "2. Press Cmd+V to toggle visitor sprite"
echo "   • A second Pokémon should appear"
echo "   • Positioned to the right and below the first"
echo ""
echo "3. Press Cmd+V again to hide visitor"
echo "   • Second Pokémon should disappear"
echo ""
echo "4. Try dragging the host sprite"
echo "   • Should be draggable with mouse"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Press ENTER to close the app when you're done testing..."
read

# Cleanup
pkill -f "electron.*pokePals" 2>/dev/null
echo ""
echo "App closed. S02 verification complete."
