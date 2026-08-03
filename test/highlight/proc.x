proc Pipeline {
// <- keyword
//   ^^^^^^^^ type
  output: chan<u32> out;
//^^^^^^ property
//        ^^^^ keyword
  config() {
//^^^^^^ keyword
    spawn Worker();
//  ^^^^^ keyword
    const_assert!(true);
//  ^^^^^^^^^^^^^ function
    ()
  }
  init { () }
//^^^^ keyword
  next(state: ()) { state }
//^^^^ keyword
}
