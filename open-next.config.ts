import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // ยังไม่เปิด incremental cache — ISR บน Cloudflare ทำงานต่างจาก Vercel
  // ค่อยกลับมาพิจารณาตอน Phase 2 ถ้าเนื้อหารายสัปดาห์ต้องการ cache
});
