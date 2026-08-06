fn compute<N: u32>(input: u32) -> u32 {
  let (left, (middle, right)) = (input, N, input);
  const LOCAL: u32 = left;
  let mapped = |item: u32| {
    let doubled = item + item;
    doubled
  };
  let selected = match input {
    bound => bound,
  };
  let folded = for (element, accumulator): (u32, u32) in range(u32:0, u32:1) {
    accumulator + element
  }(u32:0);
  helper(mapped(right)) + middle + LOCAL + selected + folded
}
