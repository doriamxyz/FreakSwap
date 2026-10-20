.syntax unified
.thumb
.cpu cortex-m4
.section .text.native_alias_route,"ax",%progbits
mov r0,fp
ldr r12,table
ldr.w r12,[r12,r0,lsl #2]
cmp r12,#0
it ne
movwne r3,#0x1669
ldr.w r0,[r4,r3,lsl #2]
ldr.w pc,continuation
.balign 4
table: .word 0x0
continuation: .word 0x0803398b
