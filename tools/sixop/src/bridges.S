.syntax unified
.cpu cortex-m4
.thumb
.section .text.bridges,"ax",%progbits
.balign 4
.global fm_boot
.thumb_func
fm_boot:
 push {r4,lr}
 bl fm_boot_init
 pop {r4,lr}
 ldr.w pc,1f
.balign 4
1: .word 0x08025731
.global fm_encoder_hook
.thumb_func
fm_encoder_hook:
 push {r0-r7,lr}
 sub sp,sp,#4
 bl fm_encoder
 cmp r0,#0
 bne 2f
 add sp,sp,#4
 pop {r0-r7,lr}
 push.w {r4-r10,lr}
 ldr.w pc,1f
2: add sp,sp,#4
 pop {r0-r7,pc}
.balign 4
1: .word 0x8042bcd
.global fm_refresh_hook
.thumb_func
fm_refresh_hook:
 push {r0-r7,lr}
 sub sp,sp,#4
 bl fm_refresh
 cmp r0,#0
 bne 2f
 add sp,sp,#4
 pop {r0-r7,lr}
 push.w {r4-r10,lr}
 ldr.w pc,1f
2: add sp,sp,#4
 pop {r0-r7,pc}
.balign 4
1: .word 0x80519f1
.global fm_tick_hook
.thumb_func
fm_tick_hook:
 push {r0-r7,lr}
 sub sp,sp,#4
 bl fm_tick
 cmp r0,#0
 bne 2f
 add sp,sp,#4
 pop {r0-r7,lr}
 push.w {r4-r11,lr}
 ldr.w pc,1f
2: add sp,sp,#4
 pop {r0-r7,pc}
.balign 4
1: .word 0x8052b89
/* Native save hook replaces the terminal write at 0x08054d00.
 * r5 is original cursor; original stack+4 owns the sector buffer.
 * Capacity failure exits before storage and preserves the dirty flag. */
.global shift_type_save_probe
.thumb_func
shift_type_save_probe:
  ldr r1,[sp,#4]
  push {r0-r4,r6,r7,lr}
  ldr r0,preset_state
  mov r2,r5
  bl mf4_save
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
.global shift_type_load_probe
.thumb_func
shift_type_load_probe:
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
  bl mf4_load
7: str r0,[sp,#4]
  add sp,sp,#4
  pop {r0-r7,pc}
.balign 4
preset_state: .word 0x2001ff80
save_continuation: .word 0x08054d05
save_abort: .word 0x08054ce5
load_continuation: .word 0x08054e0d


.global fm_configuration_hook
.thumb_func
fm_configuration_hook:
 cmp r1,#8
 it eq
 moveq r1,#9
 cmp r1,#11
 it eq
 moveq r1,#9
 push {r4}
 subs r1,#6
 ldr.w pc,1f
.balign 4
1: .word 0x0802fea9
