cask "metacubexd" do
  arch arm: "arm64", intel: "x64"

  version :latest
  sha256 :no_check

  url "https://github.com/MetaCubeX/metacubexd/releases/latest/download/MetaCubeXD-mac-#{arch}.dmg"
  name "MetaCubeXD"
  desc "Official Mihomo dashboard and desktop client"
  homepage "https://github.com/MetaCubeX/metacubexd"

  depends_on :macos

  app "MetaCubeXD.app"
end
