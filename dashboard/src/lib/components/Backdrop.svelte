<script lang="ts">
  interface Props {
    onclose: () => void;
    zIndex?: number;
  }

  let { onclose, zIndex = 50 }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="backdrop"
  style="z-index: {zIndex}"
  onclick={onclose}
  onkeydown={handleKeydown}
  role="presentation"
  aria-hidden="true"
></div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
  }
</style>
