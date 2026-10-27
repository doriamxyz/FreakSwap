// Native formatter bridge. Only Raster Density gets a new value formatter.
.syntax unified
.thumb
.cpu cortex-m4
.fpu fpv4-sp-d16
.section .text.raster_screen,"ax",%progbits
.global raster_screen
.type raster_screen,%function
.thumb_func
raster_screen:
sxth r0,r0
cmp r0,#19
bne 2f
cmp r5,#3
beq density
cmp r5,#5
it eq
moveq r0,#9
2: subs r0,#1
ldr.w pc,continuation
density:
mov r0,r4
bl raster_density_text
// Unwind the original formatter's frame, not an invented callback frame.
add sp,#8
vpop {d8,d9}
pop {r4,r5,r6,pc}
.balign 4
continuation: .word 0x0804df9b
.section .note.GNU-stack,"",%progbits
