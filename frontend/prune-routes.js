const fs = require('fs');
const path = require('path');

// Standalone Netlify pre-build script.
// Deletes Next.js API routes that import massive libraries (pdfjs-dist, xlsx) 
// BEFORE the compilation starts. This forces Next.js to exclude them from the 
// monolithic '___netlify-server-handler' bundle, while leaving them fully intact 
// on your local development computer!
const pathsToDelete = [
  path.join(__dirname, 'src/app/api/v1/files/[id]/process'),
  path.join(__dirname, 'src/app/api/v1/registers/upload-sales'),
  path.join(__dirname, 'src/app/api/v1/registers/upload-gstr2b')
];

// Always wipe the .next build cache first.
// Netlify caches .next between builds — if routes were deleted, stale
// .next/dev/types/validator.ts still references the old routes and fails tsc.
const nextDir = path.join(__dirname, '.next');
if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log('[PRE-BUILD-PRUNE] Cleared stale .next build cache');
}

console.log('[PRE-BUILD-PRUNE] Checking for heavy Next.js API routes to prune...');

pathsToDelete.forEach((p) => {
  if (fs.existsSync(p)) {
    try {
      fs.rmSync(p, { recursive: true, force: true });
      console.log(`[PRE-BUILD-PRUNE] SUCCESS: Pruned heavy route -> ${p}`);
    } catch (err) {
      console.error(`[PRE-BUILD-PRUNE] ERROR: Failed to prune ${p}:`, err);
    }
  } else {
    console.log(`[PRE-BUILD-PRUNE] SKIPPED: Route not found (already pruned) -> ${p}`);
  }
});

console.log('[PRE-BUILD-PRUNE] Pruning complete. Proceeding to compilation...');
