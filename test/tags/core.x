type Word = u32;
//   ^^^^ definition.class

struct Point { x: Word }
//     ^^^^^ definition.class
//                ^^^^ reference.class

enum State : u1 { IDLE = u1:0 }
//   ^^^^^ definition.class

trait Scale {
//    ^^^^^ definition.interface
  fn scale(x: Word) -> Word;
//   ^^^^^ definition.method
}

proc Worker {
//   ^^^^^^ definition.class
  config() { () }
  init { () }
  next(state: ()) { state }
}

proc ByteWorker = Worker;
//   ^^^^^^^^^^ definition.class
//                ^^^^^^ reference.class

fn helper(x: Word) -> Word { x }
// ^^^^^^ definition.function

fn checked!(x: u32) -> u32;
// ^^^^^^^^ definition.function

impl Point {
//   ^^^^^ reference.implementation
  fn value(self: Self) -> Word { helper(u32:1) }
//   ^^^^^ definition.method
//                               ^^^^^^ reference.call
}

fn main() {
// ^^^^ definition.function
  spawn Worker();
//      ^^^^^^ reference.call
  assert_eq!(helper(u32:1), u32:1);
//^^^^^^^^^ reference.call
//           ^^^^^^ reference.call
}
