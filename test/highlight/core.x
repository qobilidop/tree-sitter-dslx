#![feature(type_inference_v2)]
// ^ attribute

// A highlighted comment.
// <- comment

#[test]
// ^ attribute
pub fn add<N: u32>(x: u32) -> u32 {
// <- keyword
//  ^ keyword
//     ^ function
//         ^ variable.parameter
//            ^ type.builtin
//                 ^ variable.parameter
  let y = helper(x + u32:1);
//^^^ keyword
//        ^ function
//                 ^ operator
//                   ^ type.builtin
//                       ^ number
  assert_eq(y, u32:42);
//^^^^^^^^ function
  y
}

type Word = u32;
// <- keyword
//   ^ type
//          ^ type.builtin

const LIMIT = u32:7;
// <- keyword
//    ^ constant
//            ^ type.builtin

struct Point { x: Word, y: Word }
// <- keyword
//     ^ type
//             ^ property

enum State : u2 { IDLE = u2:0, RUN = u2:1 }
// <- keyword
//   ^ type
//                ^ constant

fn values(p: Point) {
  let field = p.x;
//              ^ property
  let text = "dslx";
//           ^ string
  let tick = '\n';
//           ^ string.special
  let truth = true;
//            ^ boolean
  trace_fmt!("{}", field);
//^^^^^^^^^^ function
  ()
}
