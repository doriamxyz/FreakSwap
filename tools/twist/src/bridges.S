.syntax unified
.cpu cortex-m4
.thumb
.section .text.bridges,"ax",%progbits
.balign 4
.global tw_boot
.thumb_func
tw_boot:
 push {r4,lr}
 bl tw_runtime_init
 pop {r4,lr}
 ldr r12,=tw_next
 ldr r12,[r12]
 cmp r12,#0
 beq 8f
 bx r12
8: ldr.w pc,1f
.balign 4
1: .word 0x08025731
.global tw_encoder_hook
.thumb_func
tw_encoder_hook:
 push {r0-r7,lr}
 sub sp,sp,#4
 bl tw_encoder
 cmp r0,#0
 bne 2f
 add sp,sp,#4
 pop {r0-r7,lr}
 ldr r12,=tw_next
 ldr r12,[r12,#4]
 cmp r12,#0
 beq 8f
 bx r12
8: push.w {r4-r10,lr}
 ldr.w pc,1f
2: add sp,sp,#4
 pop {r0-r7,pc}
.balign 4
1: .word 0x8042bcd
.global tw_refresh_hook
.thumb_func
tw_refresh_hook:
 push {r0-r7,lr}
 sub sp,sp,#4
 bl tw_refresh
 cmp r0,#0
 bne 2f
 add sp,sp,#4
 pop {r0-r7,lr}
 ldr r12,=tw_next
 ldr r12,[r12,#8]
 cmp r12,#0
 beq 8f
 bx r12
8: push.w {r4-r10,lr}
 ldr.w pc,1f
2: add sp,sp,#4
 pop {r0-r7,pc}
.balign 4
1: .word 0x80519f1
.global tw_tick_hook
.thumb_func
tw_tick_hook:
 push {r0-r7,lr}
 sub sp,sp,#4
 bl tw_tick
 cmp r0,#0
 bne 2f
 add sp,sp,#4
 pop {r0-r7,lr}
 ldr r12,=tw_next
 ldr r12,[r12,#12]
 cmp r12,#0
 beq 8f
 bx r12
8: push.w {r4-r11,lr}
 ldr.w pc,1f
2: add sp,sp,#4
 pop {r0-r7,pc}
.balign 4
1: .word 0x8052b89
/* Native save hook replaces the terminal write at 0x08054d00.
 * r5 is original cursor; original stack+4 owns the sector buffer.
 * Capacity failure exits before storage and preserves the dirty flag. */
.global tw_save_hook
.thumb_func
tw_save_hook:
  ldr r1,[sp,#4]
  push {r0-r4,r6,r7,lr}
  ldr r0,preset_state
  mov r2,r5
  bl tw_save
  cmp r0,#0
  blt 6f
  mov r5,r0
  pop {r0-r4,r6,r7,lr}
  ldr r2,[sp,#4]
  movs r3,#0x20
  strb r3,[r2,r5]
  ldr.w pc,save_continuation
6: pop {r0-r4,r6,r7,lr}
  ldr.w pc,save_abort

/* Native loader wrapper executes the displaced native entry load and all native
 * load code, then parses MF4 before the caller's ordinary notifications. */
.global tw_load_hook
.thumb_func
tw_load_hook:
  push {r0-r7,lr}
  sub sp,sp,#4
  adr r3,load_return
  orr lr,r3,#1
  ldr.w r3,[r0,#0x2d4]
  ldr.w pc,load_continuation
load_return:
  cmp r0,#0
  bne 7f
  ldr r1,[sp,#8]
  ldr r2,[r1,#4]
  ldr r1,[r1,#8]
  ldr r0,preset_state
  bl tw_load
7: str r0,[sp,#4]
  add sp,sp,#4
  pop {r0-r7,pc}
.balign 4
preset_state: .word 0x2001ff00
save_continuation: .word 0x08054d05
save_abort: .word 0x08054ce5
load_continuation: .word 0x08054e0d

.ltorg
